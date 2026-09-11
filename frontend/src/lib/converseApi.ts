// Client for the live voice conversation (backend/voice_agent, /ws/converse).
//
// You speak; a pause ends your turn. The backend transcribes it, reads how it
// sounded, and streams a spoken reply sentence by sentence. Talking over the
// agent interrupts it (barge-in), so this has to do three things at once:
// stream the mic up, play the agent's sentences back-to-back without gaps, and
// drop that playback the instant the server says it was interrupted.
//
// Protocol and message shapes: backend/backend.md section 3b.

import { getToken, wsUrl } from './api';
import type { Emotion } from './emotionApi';

export type ConverseState = 'listening' | 'thinking' | 'speaking';

/** How the person's last turn sounded. Never shown as numbers. */
export interface VoiceRead {
  emotion: Emotion;
  tone_word: string;
  certainty: 'high' | 'low';
  arousal?: number | null;
  valence?: number | null;
  speech_rate?: number | null;
  voiced_seconds?: number | null;
}

export interface UserTurn {
  transcript: string;
  language: 'en' | 'hi';
  voice: VoiceRead | null;
}

export interface ConverseHandlers {
  /** 'en' | 'hi' | 'auto' - the backend detects per turn on 'auto'. */
  language: 'en' | 'hi' | 'auto';
  /** false: the mic is ignored while the agent talks (for laptop speakers). */
  bargeIn: boolean;
  /** true: the agent says hello first. */
  greet: boolean;
  onState: (state: ConverseState) => void;
  onUserTurn: (turn: UserTurn) => void;
  /** One agent sentence, arriving just before its audio. */
  onAgentText: (text: string) => void;
  onAgentDone?: (reply: string, interrupted: boolean) => void;
  onCrisis: (message: string) => void;
  /** The agent was cut off - its remaining audio has already been dropped. */
  onInterrupted?: () => void;
  /**
   * Whether the agent's voice is actually coming out of the speaker. The
   * server's "speaking" state ends the moment it has sent the audio, seconds
   * before it finishes playing, so this - not the state message - is what
   * tells the person the agent is still talking.
   */
  onPlaybackChange?: (playing: boolean) => void;
  onError: (detail: string) => void;
  /** The socket closed without us ending the call. */
  onConnectionLost?: () => void;
  /** 0-255, for the orb. */
  onMicLevel?: (level: number) => void;
  onAgentLevel?: (level: number) => void;
}

export interface ConverseSession {
  /** Cut the agent off now (the "Stop" button). */
  interrupt: () => void;
  /** Say goodbye to the server and release the microphone. */
  end: () => Promise<void>;
}

export class MicrophoneError extends Error {}

const CHUNK = 4096;
/** Leaves a beat between sentences so they don't collide when one arrives late. */
const SCHEDULE_LEAD_S = 0.06;

interface PendingAudio {
  sampleRate: number;
  samples: number;
}

// Must be called directly from a click/tap handler: Safari leaves an
// AudioContext created after an await suspended, and then captures silence.
export async function startConversation(h: ConverseHandlers): Promise<ConverseSession> {
  const ctx = new AudioContext();
  const resumed = ctx.resume();

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // Echo cancellation is what makes barge-in usable on speakers: without
      // it the agent hears its own voice and interrupts itself.
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    ctx.close();
    throw new MicrophoneError('Microphone access was not granted.');
  }

  await resumed.catch(() => {});
  const sampleRate = ctx.sampleRate;

  const ws = new WebSocket(wsUrl('/ws/converse'));
  ws.binaryType = 'arraybuffer';

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 8000);
      ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error('connect'));
      };
    });
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
    ws.close();
    throw new Error('Could not reach the voice conversation service.');
  }

  let ending = false;

  // ------------------------------------------------------------- playback
  // Every agent sentence goes through one bus, so an interrupt is a single
  // stop() over the live sources and the analyser can drive the orb.
  const agentBus = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  agentBus.connect(analyser);
  analyser.connect(ctx.destination);

  const playing = new Set<AudioBufferSourceNode>();
  let nextStartTime = 0;
  let pendingAudio: PendingAudio | null = null;
  let playbackActive = false;

  const setPlayback = (active: boolean) => {
    if (playbackActive === active) return;
    playbackActive = active;
    h.onPlaybackChange?.(active);
  };

  const drained = () => {
    // The server resets its own playback clock on this, so it knows the agent
    // has really stopped and a new turn can start.
    if (!ending && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'playback_done' }));
    }
  };

  const enqueue = (meta: PendingAudio, frame: ArrayBuffer) => {
    const int16 = new Int16Array(frame);
    if (!int16.length) return;
    const buffer = ctx.createBuffer(1, int16.length, meta.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < int16.length; i++) channel[i] = int16[i] / 32768;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(agentBus);
    // Back-to-back: each sentence starts where the last one ends, so a reply
    // flows as one utterance instead of arriving in audible chunks.
    const startAt = Math.max(ctx.currentTime + SCHEDULE_LEAD_S, nextStartTime);
    source.start(startAt);
    nextStartTime = startAt + buffer.duration;
    playing.add(source);
    setPlayback(true);
    source.onended = () => {
      playing.delete(source);
      if (playing.size === 0) {
        setPlayback(false);
        drained();
      }
    };
  };

  const stopPlayback = () => {
    playing.forEach((source) => {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* already finished */
      }
      source.disconnect();
    });
    playing.clear();
    pendingAudio = null;
    nextStartTime = 0;
    setPlayback(false);
  };

  // ------------------------------------------------------------- messages
  ws.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) {
      // Each agent_audio message is followed by exactly one binary frame.
      if (pendingAudio) {
        enqueue(pendingAudio, e.data);
        pendingAudio = null;
      }
      return;
    }
    let msg: any;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    switch (msg.type) {
      case 'state':
        h.onState(msg.state);
        break;
      case 'user_turn':
        h.onUserTurn({
          transcript: msg.transcript ?? '',
          language: msg.language === 'hi' ? 'hi' : 'en',
          voice: msg.voice ?? null,
        });
        break;
      case 'agent_text':
        h.onAgentText(msg.text ?? '');
        break;
      case 'agent_audio':
        pendingAudio = { sampleRate: msg.sampleRate ?? 24000, samples: msg.samples ?? 0 };
        break;
      case 'agent_done':
        h.onAgentDone?.(msg.reply ?? '', !!msg.interrupted);
        break;
      case 'interrupted':
        // The server has already stopped talking; drop what is still queued.
        stopPlayback();
        h.onInterrupted?.();
        break;
      case 'crisis':
        h.onCrisis(msg.message ?? '');
        break;
      case 'error':
        h.onError(typeof msg.detail === 'string' ? msg.detail : 'Something went wrong on that turn.');
        break;
      case 'ready':
      default:
        break;
    }
  };

  ws.onerror = null;
  ws.onclose = () => {
    if (!ending) h.onConnectionLost?.();
  };

  const token = getToken();
  ws.send(
    JSON.stringify({
      type: 'start',
      sampleRate,
      language: h.language,
      barge_in: h.bargeIn,
      greet: h.greet,
      ...(token ? { token } : {}),
    }),
  );

  // ------------------------------------------------------------- microphone
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(CHUNK, 1, 1);
  processor.onaudioprocess = (e) => {
    const samples = e.inputBuffer.getChannelData(0);
    if (h.onMicLevel) {
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      h.onMicLevel(Math.min(255, Math.sqrt(sum / samples.length) * 1400));
    }
    if (ws.readyState === WebSocket.OPEN) ws.send(samples.slice().buffer);
  };
  source.connect(processor);
  processor.connect(ctx.destination);   // ScriptProcessor only fires while connected

  // ------------------------------------------------------------- orb level
  let frame = 0;
  if (h.onAgentLevel) {
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(bins);
      let sum = 0;
      for (let i = 0; i < bins.length; i++) sum += bins[i];
      h.onAgentLevel!(playing.size ? sum / bins.length : 0);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }

  const release = () => {
    if (frame) cancelAnimationFrame(frame);
    processor.onaudioprocess = null;
    processor.disconnect();
    source.disconnect();
    stopPlayback();
    stream.getTracks().forEach((t) => t.stop());
    if (ctx.state !== 'closed') ctx.close();
  };

  return {
    interrupt() {
      // Stop locally first so the button feels instant; the server's own
      // "interrupted" follows and is then a no-op.
      stopPlayback();
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'interrupt' }));
    },
    async end() {
      if (ending) return;
      ending = true;
      release();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'end' }));
        // Give the server the moment it needs to save the conversation's
        // voice check-in before the socket goes away.
        await new Promise((r) => setTimeout(r, 150));
      }
      ws.onmessage = null;
      ws.close();
    },
  };
}
