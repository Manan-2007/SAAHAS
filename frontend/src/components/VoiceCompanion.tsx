import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Volume2,
  Upload,
  Loader2,
  WifiOff,
} from 'lucide-react';
import { WellBeingMetric } from '../types';
import {
  EMOTIONS,
  Emotion,
  EmotionReading,
  LiveSession,
  MicrophoneError,
  checkHealth,
  predictFile,
  startLiveSession,
} from '../lib/emotionApi';

type Trend = WellBeingMetric['trend'];
type Phase = 'idle' | 'connecting' | 'recording' | 'finishing' | 'done';

interface VoiceCompanionProps {
  onBack: () => void;
  onUpdateMetric: (metricId: string, trend: Trend, description?: string) => void;
}

const SESSION_SECONDS = 60;
const MIN_VOICED_FOR_METRICS = 2;

// Gentle, non-clinical vocabulary for what the backend detects
const TONE_WORDS: Record<Emotion, string> = {
  calm: 'settled', neutral: 'steady', happy: 'warm', sad: 'heavy',
  angry: 'tense', fearful: 'uneasy', disgust: 'strained', surprised: 'stirred',
};

const TONE_COLORS: Record<Emotion, string> = {
  calm: '#00685d', neutral: '#4e5f62', happy: '#b7791f', sad: '#3f5f9a',
  angry: '#ba1a1a', fearful: '#7b4fa0', disgust: '#6b6b2f', surprised: '#c05621',
};

const REFLECTIONS: Record<Emotion, string> = {
  calm: 'Your voice carried a settled, even quality today.',
  neutral: 'I heard a steady, grounded cadence in your voice.',
  happy: 'There was warmth and a gentle lift in your voice.',
  sad: 'Your voice sounded a little heavy today, softer and slower.',
  angry: 'I noticed tension and intensity in how you spoke.',
  fearful: 'Your voice carried some unease, with a quicker, less steady rhythm.',
  disgust: 'I heard some strain in your voice today.',
  surprised: 'Your voice moved with sudden shifts and brightness.',
};

// Mirrors the backend's pick_headline: classes the model recognizes poorly
// only lead when they clearly win.
const UNRELIABLE = new Set<Emotion>(['disgust', 'fearful', 'surprised']);

interface SessionSummary {
  emotion: Emotion;
  certainty: 'high' | 'low';
  probabilities: Record<Emotion, number>;
  arousal: number;
  voicedSeconds: number;
  transcript: string;
  stress: Trend;
  energy: Trend;
  fatigue: Trend;
}

function summarize(readings: EmotionReading[]): SessionSummary | null {
  if (!readings.length) return null;
  const finals = readings.filter((r) => r.segment !== 'interim');
  const pool = finals.length ? finals : [readings[readings.length - 1]];
  const weights = pool.map((r) => Math.max(r.voicedSeconds, 0.5));
  const totalW = weights.reduce((a, b) => a + b, 0);

  const probabilities = Object.fromEntries(
    EMOTIONS.map((e) => [e, pool.reduce((acc, r, i) => acc + r.probabilities[e] * weights[i], 0) / totalW]),
  ) as Record<Emotion, number>;
  const arousal = pool.reduce((acc, r, i) => acc + r.prosody.arousal * weights[i], 0) / totalW;
  const valences = pool.filter((r) => r.prosody.valence != null);
  const valence = valences.length
    ? valences.reduce((acc, r) => acc + (r.prosody.valence as number), 0) / valences.length
    : 0.5;

  const ranked = [...EMOTIONS].sort((a, b) => probabilities[b] - probabilities[a]);
  let emotion = ranked[0];
  let demoted = false;
  if (UNRELIABLE.has(emotion) && probabilities[emotion] < 40) {
    const bestReliable = ranked.find((e) => !UNRELIABLE.has(e)) ?? emotion;
    if (probabilities[emotion] - probabilities[bestReliable] < 12) {
      emotion = bestReliable;
      demoted = true;
    }
  }
  const certainty =
    !demoted && probabilities[emotion] >= 40 && pool.some((r) => r.certainty === 'high') ? 'high' : 'low';

  const tenseNegative = emotion === 'angry' || emotion === 'fearful' || emotion === 'disgust';
  const stress: Trend =
    tenseNegative || (arousal > 0.6 && valence < 0.4)
      ? 'Elevated'
      : (emotion === 'calm' || emotion === 'neutral' || emotion === 'happy') && arousal < 0.55
      ? 'Improving'
      : 'Stable';
  const energy: Trend = arousal < 0.3 ? 'Rest needed' : arousal > 0.65 ? 'Elevated' : 'Stable';
  const fatigue: Trend = emotion === 'sad' || arousal < 0.25 ? 'Rest needed' : 'Stable';

  return {
    emotion,
    certainty,
    probabilities,
    arousal,
    voicedSeconds: pool.reduce((acc, r) => acc + r.voicedSeconds, 0),
    transcript: finals.map((r) => r.transcript).filter(Boolean).join(' '),
    stress,
    energy,
    fatigue,
  };
}

function reflectionFor(s: SessionSummary): string {
  const energyLine =
    s.arousal < 0.3
      ? 'Your energy seemed low - rest is a valid choice today.'
      : s.arousal > 0.65
      ? 'There was a lot of energy moving through your voice.'
      : 'Your energy sounded fairly even.';
  const hedge = s.certainty === 'low' ? ' This is a soft read rather than a certainty.' : '';
  return `${REFLECTIONS[s.emotion]} ${energyLine}${hedge}`;
}

const METRIC_COPY: Record<'stress' | 'energy' | 'fatigue', Partial<Record<Trend, string>>> = {
  stress: {
    Elevated: "Some tension in today's voice check-in",
    Improving: "Voice sounded settled in today's check-in",
    Stable: "Holding steady in today's voice check-in",
  },
  energy: {
    'Rest needed': 'Low vocal energy today - go gently',
    Elevated: 'Heightened vocal energy today',
    Stable: "Energy steady in today's check-in",
  },
  fatigue: {
    'Rest needed': 'Voice suggested tiredness today',
    Stable: 'No strong signs of tiredness today',
  },
};

const TREND_LABELS: Record<Trend, string> = {
  Improving: 'Calming down',
  Stable: 'Steady',
  'Rest needed': 'Rest needed',
  Elevated: 'Elevated',
};

export const VoiceCompanion: React.FC<VoiceCompanionProps> = ({ onBack, onUpdateMetric }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [secondsRemaining, setSecondsRemaining] = useState(SESSION_SECONDS);
  const [backend, setBackend] = useState<'checking' | 'online' | 'offline'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<EmotionReading | null>(null);
  const [hearingVoice, setHearingVoice] = useState(false);
  const [level, setLevel] = useState(0);
  const [transcribe, setTranscribe] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [heardNothing, setHeardNothing] = useState(false);
  const [baselineUpdated, setBaselineUpdated] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const sessionRef = useRef<LiveSession | null>(null);
  const readingsRef = useRef<EmotionReading[]>([]);
  const mountedRef = useRef(true);
  const toneRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const prompts = [
    "Take a slow breath. There is no urgency here.",
    "Speak as little or as much as feels comfortable.",
    "Silence is also welcome. Just holding this space counts.",
    "How does your body feel as you breathe out?"
  ];
  const [promptIdx, setPromptIdx] = useState(0);

  const refreshHealth = async () => {
    setBackend('checking');
    const health = await checkHealth();
    if (mountedRef.current) setBackend(health ? 'online' : 'offline');
  };

  useEffect(() => {
    mountedRef.current = true;
    refreshHealth();
    return () => {
      mountedRef.current = false;
      sessionRef.current?.stop();
      sessionRef.current = null;
      toneRef.current?.();
      toneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => setSecondsRemaining((s) => Math.max(0, s - 1)), 1000);
    const promptTimer = setInterval(() => setPromptIdx((p) => (p + 1) % prompts.length), 12000);
    return () => {
      clearInterval(timer);
      clearInterval(promptTimer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === 'recording' && secondsRemaining === 0) handleStopRecording();
  }, [phase, secondsRemaining]);

  const complete = (readings: EmotionReading[]) => {
    if (!mountedRef.current) return;
    const s = summarize(readings);
    setSummary(s);
    setHeardNothing(!s);
    const enoughSpeech = !!s && s.voicedSeconds >= MIN_VOICED_FOR_METRICS;
    if (s && enoughSpeech) {
      (['stress', 'energy', 'fatigue'] as const).forEach((id) =>
        onUpdateMetric(id, s[id], METRIC_COPY[id][s[id]]),
      );
    }
    setBaselineUpdated(enoughSpeech);
    setPhase('done');
  };

  const handleStartRecording = async () => {
    setError(null);
    setSummary(null);
    setHeardNothing(false);
    setLive(null);
    setHearingVoice(false);
    setLevel(0);
    setSecondsRemaining(SESSION_SECONDS);
    setPromptIdx(0);
    readingsRef.current = [];
    setPhase('connecting');

    try {
      const session = await startLiveSession({
        transcribe,
        onReading: (r) => {
          readingsRef.current.push(r);
          setLive(r);
          setHearingVoice(true);
        },
        onSilence: () => setHearingVoice(false),
        onLevel: (rms) => setLevel(Math.min(1, rms * 12)),
        onConnectionLost: () => {
          sessionRef.current?.stop();
          sessionRef.current = null;
          setError('The connection to voice analysis dropped. Here is what was heard so far.');
          setBackend('offline');
          complete(readingsRef.current);
        },
      });
      if (!mountedRef.current) {
        session.stop();
        return;
      }
      sessionRef.current = session;
      setPhase('recording');
    } catch (e) {
      setPhase('idle');
      if (e instanceof MicrophoneError) {
        setError('A voice check-in needs microphone access. You can allow it in your browser settings, or share a voice note instead.');
      } else {
        setError('Voice analysis is not reachable right now. Please make sure the backend is running.');
        setBackend('offline');
      }
    }
  };

  const handleStopRecording = async () => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    setPhase('finishing');
    await session.stop({ flush: true });
    complete(readingsRef.current);
  };

  const handleTranscribeToggle = (on: boolean) => {
    setTranscribe(on);
    sessionRef.current?.setTranscribe(on);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setSummary(null);
    setHeardNothing(false);
    setPhase('finishing');
    try {
      const reading = await predictFile(file);
      complete([reading]);
    } catch (err) {
      if (!mountedRef.current) return;
      setPhase('idle');
      setError(err instanceof Error ? err.message : 'That voice note could not be analysed.');
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setSecondsRemaining(SESSION_SECONDS);
    setSummary(null);
    setHeardNothing(false);
    setLive(null);
    setError(null);
  };

  const toggleTone = () => {
    if (toneRef.current) {
      toneRef.current();
      toneRef.current = null;
      setIsPlayingAudio(false);
      return;
    }
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 2);
    master.connect(ctx.destination);
    const oscillators = [174, 261.63].map((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(master);
      osc.start();
      return osc;
    });
    const swell = ctx.createOscillator();
    const swellDepth = ctx.createGain();
    swell.frequency.value = 0.1;
    swellDepth.gain.value = 0.02;
    swell.connect(swellDepth).connect(master.gain);
    swell.start();
    toneRef.current = () => {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
      setTimeout(() => {
        [...oscillators, swell].forEach((o) => o.stop());
        ctx.close();
      }, 900);
    };
    setIsPlayingAudio(true);
  };

  const isRecording = phase === 'recording';
  const hasCompleted = phase === 'done';
  const isBusy = phase === 'connecting' || phase === 'finishing';
  const offline = backend === 'offline';

  const topTones = summary
    ? [...EMOTIONS].sort((a, b) => summary.probabilities[b] - summary.probabilities[a]).slice(0, 3)
    : [];

  return (
    <div className="flex flex-col max-w-md md:max-w-xl mx-auto w-full px-4 gap-5 pb-8 animate-fadeIn">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white border border-[#ddeaf2] text-[#3d4947] hover:text-[#00685d] flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#00685d] bg-[#e9f6fd] px-3 py-1 rounded-full border border-[#ddeaf2]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Ephemeral Audio · Never saved</span>
        </span>
      </div>

      {offline && !isRecording && (
        <div className="rounded-2xl bg-[#fff8f1] border border-[#f3dcc3] p-4 flex items-start gap-3 text-xs text-[#5c4630]">
          <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Voice analysis is offline</p>
            <p className="mt-0.5 leading-relaxed">
              The voice emotion service isn't responding. Start the backend, then try again.
            </p>
          </div>
          <button onClick={refreshHealth} className="font-semibold text-[#00685d] hover:underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* Main Sanctuary Voice Sphere Card */}
      <div className="relative rounded-3xl bg-gradient-to-b from-white to-[#f4faff] border border-[#ddeaf2] p-6 sm:p-8 shadow-xs flex flex-col items-center justify-center text-center gap-6 overflow-hidden">
        {/* Soothing background aura */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[#a3ede4]/30 blur-3xl pointer-events-none"></div>

        <div className="relative">
          <span className="text-xs uppercase tracking-wider font-bold text-[#00685d]">
            Gentle Voice Check-in
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[#111d23] mt-1">
            {phase === 'connecting'
              ? "Preparing a quiet space..."
              : isRecording
              ? "Listening softly..."
              : phase === 'finishing'
              ? "Holding what you shared..."
              : hasCompleted
              ? "Check-in Complete"
              : "Express feeling without typing"}
          </h2>
          <p className="text-xs sm:text-sm text-[#3d4947] mt-1 max-w-sm mx-auto leading-relaxed">
            {isRecording
              ? prompts[promptIdx]
              : isBusy
              ? "This only takes a moment."
              : hasCompleted
              ? "Your voice pattern has been held in confidentiality."
              : "A peaceful 60-second sanctuary. Speak your thoughts or breathe quietly."}
          </p>
        </div>

        {/* Pulsing Animated Sphere */}
        <div className="relative flex items-center justify-center my-4">
          {isRecording && (
            <>
              <div
                className="absolute w-48 h-48 rounded-full bg-[#8cf5e4]/40 pointer-events-none transition-transform duration-150"
                style={{ transform: `scale(${0.85 + level * 0.35})` }}
              ></div>
              <div className="absolute w-40 h-40 rounded-full bg-[#008376]/20 animate-pulse pointer-events-none"></div>
            </>
          )}

          <div
            className={`relative w-32 h-32 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${
              isRecording
                ? 'bg-gradient-to-br from-[#00685d] to-[#008376] text-white ring-8 ring-[#a3ede4]/50 scale-105'
                : hasCompleted
                ? 'bg-[#166963] text-white ring-4 ring-[#a3ede4]'
                : 'bg-gradient-to-br from-[#8cf5e4] to-[#a3ede4] text-[#00201c]'
            }`}
          >
            {isRecording ? (
              <div className="flex flex-col items-center gap-1">
                <Mic className="w-8 h-8 text-white" />
                <span className="text-lg font-mono font-bold tracking-tight">
                  {Math.floor(secondsRemaining / 60)}:{(secondsRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
            ) : isBusy ? (
              <Loader2 className="w-10 h-10 text-[#00685d] animate-spin" />
            ) : hasCompleted ? (
              <CheckCircle2 className="w-12 h-12 text-[#a3ede4]" />
            ) : (
              <Mic className="w-12 h-12 text-[#00685d]" />
            )}
          </div>
        </div>

        {/* Live waveform, driven by the actual mic level */}
        {isRecording && (
          <div className="relative flex flex-col items-center gap-3 w-full">
            <div className="flex items-center justify-center gap-1.5 h-8 w-full max-w-xs px-4">
              {[40, 65, 85, 50, 95, 70, 45, 80, 60, 90, 55, 75, 40].map((height, i) => (
                <span
                  key={i}
                  className="w-1.5 bg-[#00685d] rounded-full transition-all duration-150"
                  style={{ height: `${Math.max(10, height * (0.2 + level * 0.8))}%` }}
                ></span>
              ))}
            </div>

            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-white border border-[#ddeaf2] shadow-2xs"
              style={{ color: live && hearingVoice ? TONE_COLORS[live.emotion] : '#6d7a77' }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: live && hearingVoice ? TONE_COLORS[live.emotion] : '#b7cacd' }}
              ></span>
              {live && hearingVoice
                ? `Your tone feels ${TONE_WORDS[live.emotion]}${live.certainty === 'low' ? ' (still settling)' : ''}`
                : 'Listening for your voice...'}
            </span>

            {transcribe && live?.transcript && (
              <p className="text-xs text-[#3d4947] italic max-w-sm">"{live.transcript}"</p>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="relative flex flex-col items-center gap-3">
          {(phase === 'idle' || phase === 'connecting') && (
            <button
              onClick={handleStartRecording}
              disabled={phase === 'connecting' || offline}
              className="px-6 py-3 rounded-2xl bg-[#00685d] text-white font-semibold text-sm shadow-md hover:bg-[#008376] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Mic className="w-4 h-4" />
              <span>Start 60s Check-in</span>
            </button>
          )}

          {isRecording && (
            <button
              onClick={handleStopRecording}
              className="px-6 py-3 rounded-2xl bg-[#ba1a1a] text-white font-semibold text-sm shadow-md hover:bg-red-700 active:scale-95 transition-all flex items-center gap-2"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Finish Early</span>
            </button>
          )}

          {hasCompleted && (
            <button
              onClick={handleReset}
              className="px-5 py-2.5 rounded-xl bg-white border border-[#ddeaf2] text-[#00685d] font-semibold text-xs hover:bg-[#e9f6fd] transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Record Another Check-in</span>
            </button>
          )}

          {(phase === 'idle' || isRecording) && (
            <label className="inline-flex items-center gap-2 text-xs text-[#3d4947] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={transcribe}
                onChange={(e) => handleTranscribeToggle(e.target.checked)}
                className="accent-[#00685d]"
              />
              <span>Show my words on screen (English only)</span>
            </label>
          )}

          {phase === 'idle' && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={offline}
                className="text-xs font-semibold text-[#00685d] flex items-center gap-1 hover:underline disabled:opacity-50 disabled:pointer-events-none"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Or share a voice note (.wav / .mp3)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".wav,.mp3,audio/wav,audio/mpeg"
                className="hidden"
                onChange={handleFileSelected}
              />
            </>
          )}
        </div>

        {error && (
          <p className="relative text-xs text-[#93000a] bg-[#ffdad6]/60 border border-[#ffdad6] rounded-xl px-3 py-2 max-w-sm">
            {error}
          </p>
        )}
      </div>

      {/* Nothing was heard - silence is a valid check-in too */}
      {hasCompleted && heardNothing && (
        <div className="rounded-2xl bg-white p-5 border border-[#ddeaf2] shadow-xs flex items-start gap-3 animate-fadeIn">
          <Sparkles className="w-5 h-5 text-[#00685d] shrink-0" />
          <p className="text-xs sm:text-sm text-[#3d4947] leading-relaxed">
            Silence is welcome too. No speech was picked up, so nothing was read from this check-in -
            simply holding this space still counts.
          </p>
        </div>
      )}

      {/* Gentle Reflection & Baseline Update Card */}
      {hasCompleted && summary && (
        <div className="rounded-2xl bg-white p-5 border border-[#ddeaf2] shadow-xs flex flex-col gap-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#00685d]">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-sm font-bold text-[#111d23]">Empathetic Sound Reflection</h3>
            </div>
            {baselineUpdated && (
              <span className="text-[11px] font-semibold text-[#1d6e67] bg-[#a3ede4]/40 px-2.5 py-0.5 rounded-full">
                Baseline Updated
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm text-[#3d4947] leading-relaxed italic bg-[#e9f6fd]/50 p-3.5 rounded-xl border border-[#ddeaf2]/60">
            "{reflectionFor(summary)}"
          </p>

          <div className="flex flex-col gap-1.5">
            {topTones.map((e) => (
              <div key={e} className="flex items-center gap-2 text-[11px] text-[#3d4947]">
                <span className="w-16 capitalize">{TONE_WORDS[e]}</span>
                <div className="flex-1 h-1.5 rounded-full bg-[#e9f6fd] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round(summary.probabilities[e])}%`, backgroundColor: TONE_COLORS[e] }}
                  ></div>
                </div>
                <span className="w-8 text-right tabular-nums">{Math.round(summary.probabilities[e])}%</span>
              </div>
            ))}
          </div>

          {summary.transcript && (
            <p className="text-[11px] text-[#6d7a77] leading-relaxed">
              <span className="font-semibold">What I heard:</span> "{summary.transcript}"
            </p>
          )}

          {!baselineUpdated && (
            <p className="text-[11px] text-[#6d7a77]">
              Only a little speech came through, so your well-being trends were left as they were.
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs text-[#6d7a77]">
              <span>Stress: <strong>{TREND_LABELS[summary.stress]}</strong></span>
              <span>·</span>
              <span>Energy: <strong>{TREND_LABELS[summary.energy]}</strong></span>
            </div>

            <button
              onClick={toggleTone}
              className="text-xs font-semibold text-[#00685d] flex items-center gap-1 hover:underline"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{isPlayingAudio ? 'Pause Tone' : 'Play Soothing Tone'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
