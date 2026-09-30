// The live spoken conversation (/ws/converse), lifted from the old VoiceCall
// component. Protocol handling lives in lib/converseApi; this is the session
// state the screen needs. Unchanged behaviour:
//   - "the agent is talking" follows local playback, not the server's state
//     message (which says listening ~0.3 s in, while seconds of audio remain)
//   - a tone word is only surfaced when the backend is confident
//   - crisis: true raises the banner immediately
//   - Punjabi has no voice pipeline yet, so it falls back to detection

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LanguageCode } from '../../types';
import { checkHealth } from '../../lib/emotionApi';
import {
  ConverseSession,
  ConverseState,
  MicrophoneError,
  VoiceRead,
  startConversation,
} from '../../lib/converseApi';

export type CallPhase = 'idle' | 'connecting' | 'live' | 'ended';
export type Health = 'checking' | 'online' | 'offline';

export interface Caption {
  id: number;
  who: 'you' | 'sahaas';
  text: string;
}

// Gentle readings of how someone sounded - never a number or a clinical word.
export const TONE_SENTENCE: Record<string, string> = {
  settled: 'You sound settled.',
  steady: 'You sound steady.',
  warm: 'There’s some warmth in your voice.',
  heavy: 'You sound a little heavy.',
  tense: 'You sound a little tense.',
  uneasy: 'You sound a little uneasy.',
  strained: 'You sound a little strained.',
  stirred: 'Your voice sounds stirred up.',
};

export function useVoiceCall({ language, onCrisis }: { language: LanguageCode; onCrisis: (message: string) => void }) {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [serverState, setServerState] = useState<ConverseState>('listening');
  const [health, setHealth] = useState<Health>('checking');
  const [error, setError] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [tone, setTone] = useState<VoiceRead | null>(null);
  const [bargeIn, setBargeIn] = useState(true);
  const [micLevel, setMicLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);
  const [playing, setPlaying] = useState(false);

  const session = useRef<ConverseSession | null>(null);
  const mounted = useRef(true);
  const captionId = useRef(0);
  const onCrisisRef = useRef(onCrisis);
  onCrisisRef.current = onCrisis;

  const refreshHealth = useCallback(async () => {
    setHealth('checking');
    const h = await checkHealth();
    if (mounted.current) setHealth(h ? 'online' : 'offline');
  }, []);

  useEffect(() => {
    mounted.current = true;
    refreshHealth();
    return () => {
      mounted.current = false;
      session.current?.end();
      session.current = null;
    };
  }, [refreshHealth]);

  const addCaption = (who: Caption['who'], text: string) => {
    if (!text.trim()) return;
    setCaptions((prev) => {
      const last = prev[prev.length - 1];
      // The agent's sentences arrive one at a time: keep a reply as one caption.
      if (last && last.who === who && who === 'sahaas') {
        return [...prev.slice(0, -1), { ...last, text: `${last.text} ${text.trim()}` }];
      }
      return [...prev, { id: captionId.current++, who, text: text.trim() }];
    });
  };

  // Must be called straight from the tap: Safari needs the AudioContext made there.
  const start = async () => {
    setError(null);
    setCaptions([]);
    setTone(null);
    setServerState('thinking');
    setPhase('connecting');
    try {
      const s = await startConversation({
        language: language === 'pa' ? 'auto' : language,
        bargeIn,
        greet: true,
        onState: (st) => setServerState(st),
        onUserTurn: (turn) => {
          if (turn.transcript) addCaption('you', turn.transcript);
          setTone(turn.voice && turn.voice.certainty === 'high' ? turn.voice : null);
        },
        onAgentText: (text) => addCaption('sahaas', text),
        onPlaybackChange: (p) => setPlaying(p),
        onCrisis: (message) => onCrisisRef.current(message),
        onError: (detail) => setError(detail),
        onConnectionLost: () => {
          if (!mounted.current) return;
          session.current = null;
          setPhase('ended');
          setHealth('offline');
          setError('The call dropped. Everything said up to here was kept.');
        },
        onMicLevel: (level) => setMicLevel(level),
        onAgentLevel: (level) => setAgentLevel(level),
      });
      if (!mounted.current) {
        s.end();
        return;
      }
      session.current = s;
      setPhase('live');
    } catch (e) {
      if (!mounted.current) return;
      setPhase('idle');
      if (e instanceof MicrophoneError) {
        setError('Talking needs the microphone. You can allow it in your browser settings, or use chat instead.');
      } else {
        setHealth('offline');
      }
    }
  };

  const end = async () => {
    const s = session.current;
    session.current = null;
    setPhase('ended');
    setMicLevel(0);
    setAgentLevel(0);
    setPlaying(false);
    await s?.end();
  };

  const interrupt = () => session.current?.interrupt();

  // While its voice is still coming out of the speaker, the agent is speaking.
  const shown: ConverseState = playing ? 'speaking' : serverState;

  return {
    phase,
    shown,
    health,
    error,
    captions,
    tone,
    bargeIn,
    setBargeIn,
    micLevel,
    agentLevel,
    playing,
    start,
    end,
    interrupt,
    refreshHealth,
  };
}
