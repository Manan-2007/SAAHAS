// Safe Chat's session logic, lifted out of the old SafeChat component so the
// screen is only presentation. Behaviour is unchanged:
//   - replies come from POST /chat with the last 16 real turns (never notices)
//   - signed-in victims pick up the stored conversation (chat + voice, one thread)
//   - voice notes stream to /ws/predict; the transcript becomes the message and
//     the tone softly informs that one reply
//   - crisis: the backend's flag, plus the local safety net, raise the banner
//   - threats or pressure raise the safety card instead
// The one deliberate change: when the chat model can't be reached, the reply
// says so plainly instead of improvising advice.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../types';
import { ConversationTurn, api } from '../../lib/api';
import {
  ChatTurn,
  Emotion,
  EmotionReading,
  LiveSession,
  MicrophoneError,
  chatReply,
  startLiveSession,
} from '../../lib/emotionApi';
import { SessionSummary, reflectionFor, summarize } from '../../lib/voiceReflection';
import { looksLikeCrisis } from './crisis';

const CHAT_HISTORY_TURNS = 16;
export const VOICE_NOTE_MAX_SECONDS = 60;

export type VoiceStage = 'idle' | 'connecting' | 'recording' | 'processing';

const TONE_FOLLOW_UPS: Record<Emotion, string> = {
  calm: 'Hold onto this steadiness - you can come back to it whenever you need.',
  neutral: "I'm here whenever you want to say more.",
  happy: "It's good to hear that warmth. Let yourself notice it.",
  sad: 'Heaviness is allowed here.',
  angry: 'Those feelings make sense.',
  disgust: "Whatever you're carrying, you don't have to hold it alone.",
  fearful: "There's no rush here. Take whatever time you need.",
  surprised: "Take a moment to let things settle. There's no rush here.",
};

function voiceNoteReply(s: SessionSummary | null): string {
  if (!s) return "I didn't pick up any speech in that voice note, and that's okay - silence is welcome here too.";
  return `Thank you for sharing your voice. ${reflectionFor(s)} ${TONE_FOLLOW_UPS[s.emotion]}`;
}

const OFFLINE_REPLY = 'SAAHAS couldn’t answer that one. Try again in a moment.';

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const atTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? now() : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fromStored = (turn: ConversationTurn, i: number): ChatMessage => ({
  id: `past-${i}`,
  sender: turn.role === 'user' ? 'user' : 'sahaas',
  senderName: turn.role === 'user' ? 'You' : 'SAAHAS',
  text: turn.content,
  timestamp: atTime(turn.at),
});

// Ids starting with note- are on-screen notices: never sent to the model.
const toChatTurns = (messages: ChatMessage[]): ChatTurn[] =>
  messages
    .filter((m) => m.sender !== 'counsellor' && !m.id.startsWith('note-'))
    .map((m): ChatTurn => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))
    .slice(-CHAT_HISTORY_TURNS);

export const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

export function useSafeChat({
  resume,
  onCrisis,
}: {
  /** Signed-in victims: load what was said before (only kept with consent). */
  resume: boolean;
  onCrisis: (message: string | null) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [resumed, setResumed] = useState(false);
  const [typing, setTyping] = useState(false);
  const [offline, setOffline] = useState(false);
  const [voiceStage, setVoiceStage] = useState<VoiceStage>('idle');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [safety, setSafety] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const messagesRef = useRef<ChatMessage[]>([]);
  const voiceSession = useRef<LiveSession | null>(null);
  const voiceReadings = useRef<EmotionReading[]>([]);
  const voiceStart = useRef(0);
  const lastTone = useRef<Emotion | null>(null);
  const mounted = useRef(true);
  const onCrisisRef = useRef(onCrisis);
  onCrisisRef.current = onCrisis;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      voiceSession.current?.stop();
      voiceSession.current = null;
    };
  }, []);

  useEffect(() => {
    if (!resume) return;
    let live = true;
    api
      .conversation()
      .then(({ turns }) => {
        if (!live || !mounted.current || turns.length === 0 || messagesRef.current.length > 0) return;
        messagesRef.current = turns.map(fromStored);
        setMessages(messagesRef.current);
        setResumed(true);
      })
      .catch(() => {
        /* nothing kept, or the backend is down: start fresh */
      });
    return () => {
      live = false;
    };
  }, [resume]);

  const append = useCallback((msg: ChatMessage) => {
    messagesRef.current = [...messagesRef.current, msg];
    setMessages(messagesRef.current);
  }, []);

  const postSahaas = useCallback(
    (text: string, notice = false) =>
      append({
        id: `${notice ? 'note' : 'bot'}-${Date.now()}-${messagesRef.current.length}`,
        sender: 'sahaas',
        senderName: 'SAAHAS',
        text,
        timestamp: now(),
      }),
    [append],
  );

  const flag = (text: string) => {
    if (looksLikeCrisis(text)) onCrisisRef.current(null);
  };

  const ask = async (fallback: () => string | null) => {
    setTyping(true);
    const tone = lastTone.current;
    lastTone.current = null;       // a voice note's tone shapes only the reply to it
    try {
      const res = await chatReply(toChatTurns(messagesRef.current), tone);
      if (!mounted.current) return;
      setOffline(false);
      if (res.crisis) onCrisisRef.current(res.crisis_message);
      if (res.safety) setSafety(true);
      if (res.recorded) setSaved(true);
      postSahaas(res.reply);
    } catch {
      if (!mounted.current) return;
      setOffline(true);
      const text = fallback();
      postSahaas(text ?? OFFLINE_REPLY, text === null);
    }
    setTyping(false);
  };

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return false;
    flag(text);
    append({ id: `usr-${Date.now()}`, sender: 'user', senderName: 'You', text, timestamp: now() });
    ask(() => null);
    return true;
  };

  const finishVoiceNote = useCallback(async () => {
    const session = voiceSession.current;
    if (!session) return;
    voiceSession.current = null;
    const seconds = Math.max(1, Math.round((Date.now() - voiceStart.current) / 1000));
    setVoiceStage('processing');
    await session.stop({ flush: true });
    if (!mounted.current) return;

    const summary = summarize(voiceReadings.current);
    const transcript = summary?.transcript ?? '';
    append({
      id: `aud-${Date.now()}`,
      sender: 'user',
      senderName: 'You',
      text: transcript ? `Voice note - "${transcript}"` : 'Voice note',
      timestamp: now(),
      isAudio: true,
      audioDuration: formatDuration(seconds),
    });
    if (summary) lastTone.current = summary.emotion;
    flag(transcript);
    setVoiceStage('idle');

    if (transcript) {
      ask(() => voiceNoteReply(summary));
    } else {
      setTyping(true);
      window.setTimeout(() => {
        if (!mounted.current) return;
        postSahaas(voiceNoteReply(summary));
        setTyping(false);
      }, 700);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [append, postSahaas]);

  // Must be called straight from the tap (Safari creates the AudioContext there).
  const startVoiceNote = async () => {
    voiceReadings.current = [];
    setRecordSeconds(0);
    setNotice(null);
    setVoiceStage('connecting');
    try {
      const session = await startLiveSession({
        transcribe: true,
        onReading: (r) => voiceReadings.current.push(r),
        onConnectionLost: () => finishVoiceNote(),
      });
      if (!mounted.current) {
        session.stop();
        return;
      }
      voiceSession.current = session;
      voiceStart.current = Date.now();
      setVoiceStage('recording');
    } catch (e) {
      setVoiceStage('idle');
      setNotice(
        e instanceof MicrophoneError
          ? 'I couldn’t reach your microphone. You can allow it in your browser settings, or simply type.'
          : 'Voice notes aren’t available right now. You can still type here.',
      );
    }
  };

  useEffect(() => {
    if (voiceStage !== 'recording') return;
    const timer = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [voiceStage]);

  useEffect(() => {
    if (voiceStage === 'recording' && recordSeconds >= VOICE_NOTE_MAX_SECONDS) finishVoiceNote();
  }, [voiceStage, recordSeconds, finishVoiceNote]);

  const toggleVoiceNote = () => {
    if (voiceStage === 'idle') startVoiceNote();
    else if (voiceStage === 'recording') finishVoiceNote();
  };

  /** Clears this screen only. What's stored is managed in Privacy. */
  const clearScreen = () => {
    lastTone.current = null;
    messagesRef.current = [];
    setMessages([]);
    setResumed(false);
  };

  return {
    messages,
    resumed,
    typing,
    offline,
    voiceStage,
    recordSeconds,
    safety,
    dismissSafety: () => setSafety(false),
    saved,
    notice,
    dismissNotice: () => setNotice(null),
    send,
    toggleVoiceNote,
    clearScreen,
  };
}
