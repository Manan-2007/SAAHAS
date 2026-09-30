import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Headphones, MessageCircle, Mic, PhoneOff, RotateCcw, Square } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useSurvivor } from '../SurvivorContext';
import { TONE_SENTENCE, useVoiceCall } from '../data/useVoiceCall';
import { ListeningOrb, OrbMode } from '../orbs/ListeningOrb';
import { Button } from '../ui/Button';
import { CrisisBanner } from '../ui/CrisisBanner';
import { ConsentCard } from '../ui/forms';
import { Notice, Serif } from '../ui/primitives';

// Voice: the signature experience. The orb is the whole screen - everything
// else is one line of words and one or two buttons.

export const Voice: React.FC = () => {
  const { t, language } = useLanguage();
  const { navigate, raiseCrisis, crisis } = useSurvivor();
  const [crisisVisible, setCrisisVisible] = useState(false);
  const call = useVoiceCall({
    language,
    onCrisis: (message) => {
      raiseCrisis(message);
      setCrisisVisible(true);
    },
  });
  const [showMyWords, setShowMyWords] = useState(true);
  const [showCaptions, setShowCaptions] = useState(true);
  const captionsBox = useRef<HTMLDivElement>(null);

  // Follow the newest caption inside its own box - never scroll the page away from the orb.
  useEffect(() => {
    const box = captionsBox.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [call.captions]);

  const offline = call.health === 'offline' && call.phase !== 'live';
  const live = call.phase === 'live';
  const userSpeaking = live && call.shown === 'listening' && call.micLevel > 18;

  const mode: OrbMode = offline
    ? 'offline'
    : call.phase === 'connecting'
      ? 'connecting'
      : call.phase === 'ended'
        ? 'finished'
        : live
          ? call.shown === 'speaking'
            ? 'replying'
            : call.shown === 'thinking'
              ? 'thinking'
              : 'listening'
          : 'idle';

  const status = offline
    ? null
    : call.phase === 'connecting'
      ? 'opening a quiet line…'
      : live
        ? call.shown === 'speaking'
          ? 'speaking · talk over me any time'
          : call.shown === 'thinking'
            ? 'thinking…'
            : userSpeaking
              ? 'i’m listening'
              : 'listening…'
        : null;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">{t('nav.voice')}</h1>
      {crisisVisible && crisis && <CrisisBanner message={crisis} onDismiss={() => setCrisisVisible(false)} />}

      <section className="flex flex-col items-center text-center gap-2 pt-2 settle">
        <div className="relative w-full flex justify-center">
          <ListeningOrb mode={mode} micLevel={call.micLevel} agentLevel={call.agentLevel} size={264} />
        </div>

        <div className="min-h-[92px] flex flex-col items-center gap-2 -mt-2" aria-live="polite">
          {offline ? (
            <>
              <p className="text-[22px] font-semibold">{t('voice.offlineTitle')}</p>
              <p className="text-[15px] text-ink-2">{t('voice.offlineSub')}</p>
            </>
          ) : call.phase === 'idle' ? (
            <>
              <Serif as="h2" className="text-[30px] leading-[1.15] text-ink">i’m here when you’re ready.</Serif>
              <p className="text-[15px] text-ink-2 max-w-[34ch]">Speak, pause, and SAHAAS answers out loud. You can talk over it any time.</p>
            </>
          ) : call.phase === 'ended' ? (
            <>
              <Serif as="h2" className="text-[30px] leading-[1.15] text-ink">thank you for talking.</Serif>
              <p className="text-[15px] text-ink-2">Come back whenever you’d like.</p>
            </>
          ) : (
            <p className="text-[20px] font-semibold text-ink">{status}</p>
          )}
          {live && call.tone && (
            <p className="text-[15px] text-ink-2">{TONE_SENTENCE[call.tone.tone_word] ?? 'I hear you.'}</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3 settle" style={{ ['--i' as string]: 1 }}>
        {offline ? (
          <>
            <Button variant="accent" accent="lilac" size="lg" full icon={RotateCcw} onClick={call.refreshHealth} busy={call.health === 'checking'}>
              {t('common.tryAgain')}
            </Button>
            <Button variant="quiet" size="lg" full icon={MessageCircle} onClick={() => navigate('chat')}>
              {t('voice.useChat')}
            </Button>
          </>
        ) : live ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="quiet" size="lg" icon={Square} disabled={!call.playing} onClick={call.interrupt}>
              Stop talking
            </Button>
            <Button variant="solid" size="lg" icon={PhoneOff} onClick={call.end}>
              End
            </Button>
          </div>
        ) : (
          <Button
            variant="accent"
            accent="lilac"
            size="lg"
            full
            icon={Mic}
            busy={call.phase === 'connecting'}
            disabled={call.health === 'checking'}
            onClick={call.start}
          >
            {call.phase === 'ended' ? 'Talk again' : 'Start talking'}
          </Button>
        )}

        {call.error && <Notice tone="error">{call.error}</Notice>}

        {call.phase === 'idle' && !offline && (
          <>
            <ConsentCard
              accent="lilac"
              title="Let me interrupt"
              hint="Speak any time and SAHAAS stops to listen. On laptop speakers it may hear itself - headphones help, or turn this off."
              on={call.bargeIn}
              onToggle={() => call.setBargeIn(!call.bargeIn)}
            />
            {language === 'pa' && (
              <Notice>Spoken conversation works in English and Hindi. Punjabi isn’t ready yet - chat is there whenever you want it.</Notice>
            )}
          </>
        )}

        {(call.phase === 'idle' || call.phase === 'ended') && (
          <Button variant="ghost" icon={Headphones} onClick={() => navigate('voice-checkin')}>
            Not up for a conversation? Leave a 60-second check-in
          </Button>
        )}
      </section>

      {(live || call.captions.length > 0) && (
        <section aria-labelledby="captions" className="rounded-card bg-surface border border-line settle" style={{ ['--i' as string]: 2 }}>
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <h2 id="captions" className="flex-1 text-[15px] font-semibold">what’s been said</h2>
            <button
              type="button"
              onClick={() => setShowMyWords((v) => !v)}
              className="min-h-11 px-2 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
            >
              {showMyWords ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
              {showMyWords ? 'Hide my words' : 'Show my words'}
            </button>
            <button
              type="button"
              aria-expanded={showCaptions}
              onClick={() => setShowCaptions((v) => !v)}
              className="min-h-11 px-2 text-sm text-ink-2 hover:text-ink"
            >
              {showCaptions ? 'Hide' : 'Show'}
            </button>
          </div>
          {showCaptions && (
            <div ref={captionsBox} className="max-h-72 overflow-y-auto px-4 pb-4 flex flex-col gap-2.5">
              {call.captions.length === 0 && <p className="text-sm text-ink-2 py-3 text-center">Whatever is said out loud will appear here.</p>}
              {call.captions.map((c) =>
                c.who === 'you' && !showMyWords ? null : (
                  <p
                    key={c.id}
                    className={`max-w-[86%] px-3.5 py-2.5 text-[15px] leading-relaxed break-soft ${
                      c.who === 'you' ? 'self-end rounded-tile rounded-br-[5px] bg-lilac text-on-accent' : 'self-start rounded-tile rounded-bl-[5px] bg-raised text-ink'
                    }`}
                  >
                    <span className="sr-only">{c.who === 'you' ? 'You: ' : 'SAHAAS: '}</span>
                    {c.text}
                  </p>
                ),
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
