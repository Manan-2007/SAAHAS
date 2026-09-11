import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Headphones,
  Loader2,
  PhoneOff,
  ShieldCheck,
  Square,
  WifiOff,
} from 'lucide-react';
import { Orb, OrbState } from './Orb';
import { CrisisBanner } from './CrisisBanner';
import { checkHealth } from '../lib/emotionApi';
import { TONE_COLORS } from '../lib/voiceReflection';
import {
  ConverseSession,
  ConverseState,
  MicrophoneError,
  UserTurn,
  VoiceRead,
  startConversation,
} from '../lib/converseApi';
import { LanguageCode } from '../types';

type Phase = 'idle' | 'connecting' | 'live' | 'ended';

interface VoiceCallProps {
  onBack: () => void;
  onOpenCall: () => void;
  /** The quieter one-way alternative: a 60-second voice check-in. */
  onCheckIn: () => void;
  language: LanguageCode;
}

interface Caption {
  id: number;
  who: 'you' | 'sahaas';
  text: string;
}

// Gentle, non-clinical readings of how someone sounded. Never a number, never
// a clinical label - and only shown when the backend is confident.
const TONE_SENTENCE: Record<string, string> = {
  settled: 'You sound settled.',
  steady: 'You sound steady.',
  warm: "There's some warmth in your voice.",
  heavy: 'You sound a little heavy.',
  tense: 'You sound a little tense.',
  uneasy: 'You sound a little uneasy.',
  strained: 'You sound a little strained.',
  stirred: 'Your voice sounds stirred up.',
};

const STATE_LABEL: Record<ConverseState, string> = {
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking — you can talk over me any time',
};

export const VoiceCall: React.FC<VoiceCallProps> = ({ onBack, onOpenCall, onCheckIn, language }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [state, setState] = useState<ConverseState>('listening');
  const [backend, setBackend] = useState<'checking' | 'online' | 'offline'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [crisis, setCrisis] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [tone, setTone] = useState<VoiceRead | null>(null);
  const [showMyWords, setShowMyWords] = useState(true);
  const [bargeIn, setBargeIn] = useState(true);
  const [micLevel, setMicLevel] = useState(0);
  const [agentLevel, setAgentLevel] = useState(0);
  // The server calls itself "listening" again as soon as it has sent the
  // audio - seconds before that audio finishes playing. What the person hears
  // is the playback, so that is what the orb and the Stop button follow.
  const [playing, setPlaying] = useState(false);

  const sessionRef = useRef<ConverseSession | null>(null);
  const mountedRef = useRef(true);
  const captionIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      sessionRef.current?.end();
      sessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [captions]);

  const addCaption = (who: Caption['who'], text: string) => {
    if (!text.trim()) return;
    setCaptions((prev) => {
      const last = prev[prev.length - 1];
      // Agent sentences arrive one at a time; keep a reply as one bubble.
      if (last && last.who === who && who === 'sahaas') {
        return [...prev.slice(0, -1), { ...last, text: `${last.text} ${text.trim()}` }];
      }
      return [...prev, { id: captionIdRef.current++, who, text: text.trim() }];
    });
  };

  // Punjabi isn't in the voice pipeline yet, so we let the backend detect
  // instead of promising a language it can't speak.
  const spokenLanguage = language === 'pa' ? 'auto' : language;

  const handleStart = async () => {
    setError(null);
    setCaptions([]);
    setTone(null);
    setState('thinking');
    setPhase('connecting');

    try {
      const session = await startConversation({
        language: spokenLanguage,
        bargeIn,
        greet: true,
        onState: (s) => setState(s),
        onUserTurn: (turn: UserTurn) => {
          if (turn.transcript) addCaption('you', turn.transcript);
          // A soft guess stays private: only a confident read is shown.
          setTone(turn.voice && turn.voice.certainty === 'high' ? turn.voice : null);
        },
        onAgentText: (text) => addCaption('sahaas', text),
        onPlaybackChange: (isPlaying) => setPlaying(isPlaying),
        onCrisis: (message) => setCrisis(message),
        onError: (detail) => setError(detail),
        onConnectionLost: () => {
          if (!mountedRef.current) return;
          sessionRef.current = null;
          setPhase('ended');
          setBackend('offline');
          setError('The call dropped. Everything you said up to here was kept.');
        },
        onMicLevel: (level) => setMicLevel(level),
        onAgentLevel: (level) => setAgentLevel(level),
      });

      if (!mountedRef.current) {
        session.end();
        return;
      }
      sessionRef.current = session;
      setPhase('live');
    } catch (e) {
      if (!mountedRef.current) return;
      setPhase('idle');
      if (e instanceof MicrophoneError) {
        setError('A conversation needs microphone access. You can allow it in your browser settings, or use the chat instead.');
      } else {
        setError('The conversation service is not reachable right now. Please make sure the backend is running.');
        setBackend('offline');
      }
    }
  };

  const handleEnd = async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setPhase('ended');
    setMicLevel(0);
    setAgentLevel(0);
    setPlaying(false);
    await session?.end();
  };

  // While its voice is still coming out of the speaker, the agent is speaking -
  // whatever the server's last state message said.
  const shown: ConverseState = playing ? 'speaking' : state;
  const orbState: OrbState =
    phase === 'connecting' ? 'thinking' : phase === 'live' ? shown : 'idle';

  const offline = backend === 'offline';
  const live = phase === 'live';

  return (
    <div className="flex flex-col max-w-md md:max-w-xl mx-auto w-full px-4 gap-5 pb-8 animate-fadeIn">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white border border-[#e5dac4] text-[#5c5142] hover:text-[#9c6743] flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#9c6743] bg-[#efe7d6] px-3 py-1 rounded-full border border-[#e5dac4]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Private &amp; encrypted</span>
        </span>
      </div>

      {crisis && <CrisisBanner message={crisis} onCall={onOpenCall} onDismiss={() => setCrisis(null)} />}

      {offline && !live && (
        <div className="rounded-2xl bg-[#fff8f1] border border-[#f3dcc3] p-4 flex items-start gap-3 text-xs text-[#5c4630]">
          <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">The conversation service is offline</p>
            <p className="mt-0.5 leading-relaxed">
              SAHAAS can't talk right now. Start the backend, then try again.
            </p>
          </div>
          <button onClick={refreshHealth} className="font-semibold text-[#9c6743] hover:underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* The call itself */}
      <div className="relative rounded-3xl bg-gradient-to-b from-white to-[#f5f1e8] border border-[#e5dac4] p-6 sm:p-8 shadow-xs flex flex-col items-center text-center gap-5 overflow-hidden">
        <div className="absolute -top-24 -right-16 w-56 h-56 rounded-full bg-[#e7d3b5]/30 blur-3xl pointer-events-none" />

        <div className="relative">
          <Orb state={orbState} micVolume={micLevel} speakerVolume={agentLevel} size={200} />
        </div>

        {phase === 'idle' && (
          <>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-[#352e24]">Talk with SAHAAS</h2>
              <p className="text-sm text-[#5c5142] leading-relaxed max-w-xs mx-auto">
                A real back-and-forth, out loud. Just speak — pause when you're done, and
                SAHAAS answers. You can talk over it whenever you want.
              </p>
            </div>

            <button
              onClick={handleStart}
              disabled={backend === 'checking'}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#9c6743] text-white font-bold text-sm shadow-[0_4px_14px_rgba(156,103,67,0.35)] hover:bg-[#b3654a] active:scale-[0.99] transition-all disabled:opacity-60"
            >
              Start the conversation
            </button>

            <label className="flex items-start gap-2.5 text-left text-xs text-[#5c5142] bg-[#efe7d6]/60 rounded-2xl p-3 border border-[#e5dac4]">
              <input
                type="checkbox"
                checked={bargeIn}
                onChange={(e) => setBargeIn(e.target.checked)}
                className="mt-0.5 accent-[#9c6743]"
              />
              <span className="flex-1 leading-relaxed">
                <span className="font-semibold text-[#352e24]">Let me interrupt</span> — speak any
                time and SAHAAS stops to listen.
                <span className="flex items-center gap-1 mt-1 text-[#7a5a3f]">
                  <Headphones className="w-3.5 h-3.5 shrink-0" />
                  On laptop speakers it may hear itself. Headphones help, or turn this off.
                </span>
              </span>
            </label>

            <button
              onClick={onCheckIn}
              className="text-xs font-semibold text-[#9c6743] hover:underline"
            >
              Not up for talking? Leave a 60-second check-in instead
            </button>

            {language === 'pa' && (
              <p className="text-[11px] text-[#7a5a3f] leading-relaxed">
                Spoken conversation is available in English and Hindi. Punjabi isn't ready yet —
                the chat is still there whenever you want it.
              </p>
            )}
          </>
        )}

        {phase === 'connecting' && (
          <p className="flex items-center gap-2 text-sm font-semibold text-[#9c6743]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting…
          </p>
        )}

        {live && (
          <>
            <p className="text-sm font-semibold text-[#9c6743] min-h-[20px]">{STATE_LABEL[shown]}</p>

            {tone && (
              <p className="inline-flex items-center gap-2 text-xs text-[#5c5142] bg-white/80 border border-[#e5dac4] rounded-full px-3 py-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: TONE_COLORS[tone.emotion] ?? '#9c6743' }}
                />
                {TONE_SENTENCE[tone.tone_word] ?? 'I hear you.'}
              </p>
            )}

            <div className="flex items-center gap-2.5 w-full justify-center flex-wrap">
              <button
                onClick={() => sessionRef.current?.interrupt()}
                disabled={!playing}
                className="px-4 py-2.5 rounded-2xl bg-white border border-[#e5dac4] text-[#5c5142] font-semibold text-xs flex items-center gap-1.5 hover:text-[#9c6743] disabled:opacity-40 transition-all"
              >
                <Square className="w-3.5 h-3.5" />
                Stop talking
              </button>
              <button
                onClick={handleEnd}
                className="px-5 py-2.5 rounded-2xl bg-[#ba1a1a] text-white font-bold text-xs flex items-center gap-1.5 hover:bg-[#9f1414] active:scale-[0.99] transition-all"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                End call
              </button>
            </div>
          </>
        )}

        {phase === 'ended' && (
          <>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-[#352e24]">The call has ended</h2>
              <p className="text-sm text-[#5c5142] leading-relaxed max-w-xs mx-auto">
                Thank you for talking. Come back whenever you'd like.
              </p>
            </div>
            <button
              onClick={handleStart}
              className="px-6 py-3 rounded-2xl bg-[#9c6743] text-white font-bold text-sm shadow-[0_4px_14px_rgba(156,103,67,0.35)] hover:bg-[#b3654a] active:scale-[0.99] transition-all"
            >
              Talk again
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-2xl bg-[#fff1ef] border border-[#ffdad6] p-3 text-xs text-[#5c1a14] leading-relaxed">
          {error}
        </p>
      )}

      {/* Captions */}
      {(live || captions.length > 0) && (
        <div className="rounded-3xl bg-white border border-[#e5dac4] shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#efe7d6]">
            <span className="text-xs font-bold text-[#352e24]">What's being said</span>
            <button
              onClick={() => setShowMyWords((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#5c5142] hover:text-[#9c6743]"
            >
              {showMyWords ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {showMyWords ? 'Hide my words' : 'Show my words'}
            </button>
          </div>

          <div ref={scrollRef} className="max-h-64 overflow-y-auto p-4 flex flex-col gap-2.5">
            {captions.length === 0 && (
              <p className="text-xs text-[#837562] text-center py-4">
                Whatever is said out loud will appear here.
              </p>
            )}
            {captions.map((caption) =>
              caption.who === 'you' && !showMyWords ? null : (
                <div
                  key={caption.id}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    caption.who === 'you'
                      ? 'self-end bg-[#9c6743] text-white'
                      : 'self-start bg-[#f5f1e8] text-[#352e24] border border-[#efe7d6]'
                  }`}
                >
                  {caption.text}
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
};
