import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Mic, RotateCcw, Square, Upload } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useLanguage } from '../../i18n/LanguageProvider';
import { TONE_WORDS, reflectionFor } from '../../lib/voiceReflection';
import { useSurvivor } from '../SurvivorContext';
import { useVoiceCheckIn } from '../data/useVoiceCheckIn';
import { ListeningOrb, OrbMode } from '../orbs/ListeningOrb';
import { Button } from '../ui/Button';
import { ConsentCard } from '../ui/forms';
import { Notice, ScreenHeader, Serif } from '../ui/primitives';

const PROMPTS = [
  'Take a slow breath. There’s no hurry here.',
  'Say as little or as much as feels okay.',
  'Silence is welcome too.',
  'How does your body feel as you breathe out?',
];

export const VoiceCheckIn: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { back, navigate, isGuest } = useSurvivor();
  const c = useVoiceCheckIn();
  const [prompt, setPrompt] = useState(0);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (c.phase !== 'recording') return;
    const timer = window.setInterval(() => setPrompt((p) => (p + 1) % PROMPTS.length), 12000);
    return () => window.clearInterval(timer);
  }, [c.phase]);

  const offline = c.health === 'offline' && c.phase !== 'recording';
  const recording = c.phase === 'recording';
  const mode: OrbMode = offline
    ? 'offline'
    : c.phase === 'connecting' || c.phase === 'finishing'
      ? 'connecting'
      : recording
        ? 'listening'
        : c.phase === 'done'
          ? 'finished'
          : 'idle';

  const privacy = isGuest
    ? 'private · nothing is saved without an account'
    : user.consent.store_recordings
      ? 'private · the recording is kept encrypted, for you and your counsellor'
      : user.consent.voice_analysis !== false
        ? 'private · the audio isn’t kept, only a sense of how you sounded'
        : 'private · nothing about this check-in is saved';

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="A 60-second check-in" onBack={back} />
      <p className="text-sm text-ink-2 -mt-3 pl-[60px]">{privacy}</p>

      <section className="flex flex-col items-center text-center gap-2 settle" style={{ ['--i' as string]: 1 }}>
        <ListeningOrb mode={mode} micLevel={c.level * 255} size={236} />
        <div className="min-h-[96px] flex flex-col items-center gap-2 -mt-2" aria-live="polite">
          {offline ? (
            <>
              <p className="text-[22px] font-semibold">{t('voice.offlineTitle')}</p>
              <p className="text-[15px] text-ink-2">{t('voice.offlineSub')}</p>
            </>
          ) : recording ? (
            <>
              <p className="text-[40px] font-light tabular-nums leading-none" aria-label={`${c.secondsLeft} seconds left`}>
                {Math.floor(c.secondsLeft / 60)}:{(c.secondsLeft % 60).toString().padStart(2, '0')}
              </p>
              <Serif className="text-[19px] text-ink-2 max-w-[28ch]">{PROMPTS[prompt]}</Serif>
              <p className="text-sm text-ink-2">
                {c.live && c.hearingVoice
                  ? `your voice sounds ${TONE_WORDS[c.live.emotion]}${c.live.certainty === 'low' ? ', maybe' : ''}`
                  : 'listening for your voice…'}
              </p>
              {c.transcribe && c.live?.transcript && <p className="text-[15px] text-ink italic max-w-[34ch]">“{c.live.transcript}”</p>}
            </>
          ) : c.phase === 'idle' ? (
            <>
              <Serif as="h2" className="text-[28px] leading-[1.15]">say how it’s been, out loud.</Serif>
              <p className="text-[15px] text-ink-2 max-w-[34ch]">
                One minute, one way. Speak, or just breathe - SAAHAS gently notices how your voice sounds.
              </p>
            </>
          ) : c.phase === 'done' ? null : (
            <p className="text-[18px] text-ink-2 hush">{c.phase === 'connecting' ? 'opening a quiet space…' : 'holding what you shared…'}</p>
          )}
        </div>
      </section>

      {c.phase === 'done' && (
        <section className="rounded-card bg-surface border border-line px-6 py-6 flex flex-col gap-4 settle">
          {c.summary ? (
            <>
              <Serif className="text-[22px] leading-[1.35] text-ink break-soft">{reflectionFor(c.summary)}</Serif>
              {c.summary.transcript && (
                <p className="text-[15px] text-ink-2 break-soft">
                  <span className="font-semibold text-ink">what i heard · </span>“{c.summary.transcript}”
                </p>
              )}
            </>
          ) : (
            <Serif className="text-[22px] leading-[1.35] text-ink">
              silence is welcome too. nothing was heard, so nothing was read from it - and simply holding this space still counts.
            </Serif>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3 settle" style={{ ['--i' as string]: 2 }}>
        {offline ? (
          <>
            <Button variant="accent" accent="lilac" size="lg" full icon={RotateCcw} onClick={c.refreshHealth} busy={c.health === 'checking'}>
              {t('common.tryAgain')}
            </Button>
            <Button variant="quiet" size="lg" full icon={MessageCircle} onClick={() => navigate('chat')}>
              {t('voice.useChat')}
            </Button>
          </>
        ) : recording ? (
          <Button variant="solid" size="lg" full icon={Square} onClick={c.stop}>
            Finish now
          </Button>
        ) : c.phase === 'done' ? (
          <>
            <Button variant="accent" accent="lilac" size="lg" full icon={Mic} onClick={() => navigate('voice')}>
              Talk it through
            </Button>
            <Button variant="quiet" size="lg" full icon={RotateCcw} onClick={c.reset}>
              Check in again
            </Button>
          </>
        ) : (
          <Button
            variant="accent"
            accent="lilac"
            size="lg"
            full
            icon={Mic}
            busy={c.phase === 'connecting' || c.phase === 'finishing'}
            disabled={c.health === 'checking'}
            onClick={c.start}
          >
            Start the minute
          </Button>
        )}

        {c.error && <Notice tone="error">{c.error}</Notice>}

        {(c.phase === 'idle' || recording) && !offline && (
          <ConsentCard
            accent="lilac"
            title="Show my words on screen"
            hint="English only. Your words appear as you speak."
            on={c.transcribe}
            onToggle={() => c.setTranscribe(!c.transcribe)}
          />
        )}

        {c.phase === 'idle' && !offline && (
          <>
            <Button variant="ghost" icon={Upload} onClick={() => file.current?.click()}>
              Or share a voice note file (.wav or .mp3)
            </Button>
            <input
              ref={file}
              type="file"
              accept=".wav,.mp3,audio/wav,audio/mpeg"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) c.upload(f);
              }}
            />
          </>
        )}
      </section>
    </div>
  );
};
