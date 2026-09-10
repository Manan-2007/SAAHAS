// Client for the voice emotion backend (../backend, FastAPI).
// In dev, Vite proxies /health, /predict and /ws to the backend, so the
// default same-origin base works. For a separately hosted backend, set
// VITE_API_URL (e.g. "https://emotion.example.com").

export const EMOTIONS = [
  'angry', 'calm', 'disgust', 'fearful', 'happy', 'neutral', 'sad', 'surprised',
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export interface Prosody {
  pitch_hz: number;
  pitch_var_hz: number;
  pitch_var: number;
  energy_mod: number;
  speech_rate: number;
  speech_rate_norm: number;
  arousal: number;
  valence?: number;
  arousal_prosody?: number;
  arousal_adjusted?: number;
  valence_adjusted?: number;
}

export interface EmotionReading {
  emotion: Emotion;
  confidence: number;                        // 0-100
  certainty: 'high' | 'low';
  probabilities: Record<Emotion, number>;    // 0-100
  prosody: Prosody;
  voicedSeconds: number;
  transcript: string | null;
  engine: string;
  segment: 'interim' | 'final' | 'upload';
}

export interface BackendHealth {
  status: string;
  engine: string;
  dimensional: string | null;
  transcription: boolean;
}

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

const httpUrl = (path: string) => `${API_BASE}${path}`;
const wsUrl = (path: string) =>
  `${(API_BASE || window.location.origin).replace(/^http/, 'ws')}${path}`;

export async function checkHealth(timeoutMs = 3000): Promise<BackendHealth | null> {
  try {
    const res = await fetch(httpUrl('/health'), { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function predictFile(file: File): Promise<EmotionReading> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(httpUrl('/predict'), { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.detail === 'string' ? data.detail : `Analysis failed (${res.status})`);
  }
  return {
    emotion: data.Emotion,
    confidence: data.Confidence,
    certainty: data.Confidence >= 40 ? 'high' : 'low',
    probabilities: data.Probabilities,
    prosody: data.Prosody,
    voicedSeconds: data.VoicedSeconds,
    transcript: data.Transcript ?? null,
    engine: data.Engine,
    segment: 'upload',
  };
}

export class MicrophoneError extends Error {}

export interface LiveSessionHandlers {
  transcribe: boolean;
  onReading: (reading: EmotionReading) => void;
  onSilence?: () => void;
  onLevel?: (rms: number) => void;
  onConnectionLost?: () => void;
}

export interface LiveSession {
  setTranscribe: (on: boolean) => void;
  // Stops the mic. With flush, keeps the socket open briefly and feeds it
  // trailing silence so the backend closes and finalizes the last utterance.
  stop: (opts?: { flush?: boolean }) => Promise<void>;
}

const CHUNK = 4096;
const FLUSH_TIMEOUT_MS = 4000;

export async function startLiveSession(h: LiveSessionHandlers): Promise<LiveSession> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    throw new MicrophoneError('Microphone access was not granted.');
  }

  const ctx = new AudioContext();
  await ctx.resume();
  const sampleRate = ctx.sampleRate;

  const ws = new WebSocket(wsUrl('/ws/predict'));
  ws.binaryType = 'arraybuffer';

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 5000);
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('connect')); };
    });
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
    ws.close();
    throw new Error('Could not reach the voice analysis service.');
  }

  let stopping = false;
  let finalWaiter: (() => void) | null = null;

  ws.send(JSON.stringify({ sampleRate, transcribe: h.transcribe }));

  ws.onmessage = (e) => {
    let msg: any;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.status === 'ok') {
      h.onReading({
        emotion: msg.emotion,
        confidence: msg.confidence,
        certainty: msg.certainty,
        probabilities: msg.probabilities,
        prosody: msg.prosody,
        voicedSeconds: msg.voiced_seconds,
        transcript: msg.transcript ?? null,
        engine: msg.engine,
        segment: msg.segment,
      });
      if (msg.segment === 'final') finalWaiter?.();
    } else if (msg.status === 'silence') {
      h.onSilence?.();
    }
  };
  ws.onerror = null;
  ws.onclose = () => { if (!stopping) h.onConnectionLost?.(); };

  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(CHUNK, 1, 1);
  processor.onaudioprocess = (e) => {
    const samples = e.inputBuffer.getChannelData(0);
    if (h.onLevel) {
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      h.onLevel(Math.sqrt(sum / samples.length));
    }
    if (ws.readyState === WebSocket.OPEN) ws.send(samples.slice().buffer);
  };
  source.connect(processor);
  processor.connect(ctx.destination);   // ScriptProcessor only fires while connected

  const releaseMic = () => {
    processor.onaudioprocess = null;
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    if (ctx.state !== 'closed') ctx.close();
  };

  return {
    setTranscribe(on) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ transcribe: on }));
    },
    async stop({ flush = false } = {}) {
      if (stopping) return;
      stopping = true;
      releaseMic();
      if (flush && ws.readyState === WebSocket.OPEN) {
        // Stream silence in real time: the backend throttles analysis cycles,
        // so one big block of zeros could land between cycles and never close
        // the utterance.
        const silence = new Float32Array(CHUNK).buffer;
        await new Promise<void>((resolve) => {
          const pump = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(silence);
          }, (CHUNK / sampleRate) * 1000);
          const done = () => { clearInterval(pump); clearTimeout(timer); finalWaiter = null; resolve(); };
          const timer = setTimeout(done, FLUSH_TIMEOUT_MS);
          finalWaiter = done;
        });
      }
      ws.onmessage = null;
      ws.close();
    },
  };
}
