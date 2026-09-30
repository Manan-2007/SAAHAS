// The 60-second voice check-in (/ws/predict, or a .wav/.mp3 to /predict),
// lifted from the old VoiceCompanion. Streaming, flushing the last utterance
// on stop, and the reflection built from the real readings are unchanged.
// What changed: the survivor never sees the model's probabilities as
// percentages any more - only the gentle reflection.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EmotionReading,
  LiveSession,
  MicrophoneError,
  checkHealth,
  predictFile,
  startLiveSession,
} from '../../lib/emotionApi';
import { SessionSummary, summarize } from '../../lib/voiceReflection';
import type { Health } from './useVoiceCall';

export type CheckInPhase = 'idle' | 'connecting' | 'recording' | 'finishing' | 'done';
export const CHECKIN_SECONDS = 60;

export function useVoiceCheckIn() {
  const [phase, setPhase] = useState<CheckInPhase>('idle');
  const [secondsLeft, setSecondsLeft] = useState(CHECKIN_SECONDS);
  const [health, setHealth] = useState<Health>('checking');
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<EmotionReading | null>(null);
  const [hearingVoice, setHearingVoice] = useState(false);
  const [level, setLevel] = useState(0);
  const [transcribe, setTranscribeState] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const session = useRef<LiveSession | null>(null);
  const readings = useRef<EmotionReading[]>([]);
  const mounted = useRef(true);

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
      // Leaving mid check-in still keeps what was said: flush closes the last utterance.
      session.current?.stop({ flush: true });
      session.current = null;
    };
  }, [refreshHealth]);

  const complete = useCallback((list: EmotionReading[]) => {
    if (!mounted.current) return;
    setSummary(summarize(list));
    setPhase('done');
  }, []);

  const stop = useCallback(async () => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    setPhase('finishing');
    await s.stop({ flush: true });
    complete(readings.current);
  }, [complete]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === 'recording' && secondsLeft === 0) stop();
  }, [phase, secondsLeft, stop]);

  // Must be called straight from the tap (Safari).
  const start = async () => {
    setError(null);
    setSummary(null);
    setLive(null);
    setHearingVoice(false);
    setLevel(0);
    setSecondsLeft(CHECKIN_SECONDS);
    readings.current = [];
    setPhase('connecting');
    try {
      const s = await startLiveSession({
        transcribe,
        onReading: (r) => {
          readings.current.push(r);
          setLive(r);
          setHearingVoice(true);
        },
        onSilence: () => setHearingVoice(false),
        onLevel: (rms) => setLevel(Math.min(1, rms * 12)),
        onConnectionLost: () => {
          session.current?.stop();
          session.current = null;
          setError('The connection dropped. Here is what was heard so far.');
          setHealth('offline');
          complete(readings.current);
        },
      });
      if (!mounted.current) {
        s.stop();
        return;
      }
      session.current = s;
      setPhase('recording');
    } catch (e) {
      setPhase('idle');
      if (e instanceof MicrophoneError) {
        setError('A voice check-in needs the microphone. You can allow it in your browser settings, or share a voice note file instead.');
      } else {
        setHealth('offline');
      }
    }
  };

  const setTranscribe = (on: boolean) => {
    setTranscribeState(on);
    session.current?.setTranscribe(on);
  };

  const upload = async (file: File) => {
    setError(null);
    setSummary(null);
    setPhase('finishing');
    try {
      complete([await predictFile(file)]);
    } catch (err) {
      if (!mounted.current) return;
      setPhase('idle');
      setError(err instanceof Error ? err.message : 'That voice note couldn’t be listened to.');
    }
  };

  const reset = () => {
    setPhase('idle');
    setSecondsLeft(CHECKIN_SECONDS);
    setSummary(null);
    setLive(null);
    setError(null);
  };

  return {
    phase,
    secondsLeft,
    health,
    error,
    live,
    hearingVoice,
    level,
    transcribe,
    setTranscribe,
    summary,
    start,
    stop,
    upload,
    reset,
    refreshHealth,
  };
}
