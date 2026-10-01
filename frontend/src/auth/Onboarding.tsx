import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  type LucideIcon,
  ArrowRight,
  Clock,
  Heart,
  MessageCircle,
  Mic,
  Moon,
  Music,
  PenLine,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Users,
  Wind,
} from 'lucide-react';
import { AuthError, LanguageCode, OnboardingProfile, SessionUser, saveProfile } from './authStore';
import { useLanguage } from '../i18n/LanguageProvider';
import { EntryShell } from '../survivor/entry/EntryShell';
import { Button, IconButton } from '../survivor/ui/Button';
import { LanguageSwitcher, TextField } from '../survivor/ui/forms';
import { Choice, ChoiceGroup, Notice, ProgressIndicator, Serif } from '../survivor/ui/primitives';

// A gentle baseline, captured once: the person's OWN normal, which later
// check-ins are read against. One question per screen, nothing is a test,
// and the answers (the same values as before) are stored encrypted.

interface OnboardingProps {
  user: SessionUser;
  onComplete: (user: SessionUser) => void;
}

type Draft = Omit<OnboardingProfile, 'completedAt'>;
type Option = { value: string; icon: LucideIcon };

const COPING: Option[] = [
  { value: 'Talking it out', icon: MessageCircle },
  { value: 'Quiet time alone', icon: Moon },
  { value: 'Staying busy', icon: Sparkles },
  { value: 'Prayer or faith', icon: Heart },
  { value: 'Listening to music', icon: Music },
];
const LOW_TIME: Option[] = [
  { value: 'Mornings', icon: Sunrise },
  { value: 'Afternoons', icon: Sun },
  { value: 'Evenings', icon: Sunset },
  { value: 'Late at night', icon: Moon },
  { value: 'It varies', icon: Clock },
];
const CHANNEL: Option[] = [
  { value: 'Speaking out loud', icon: Mic },
  { value: 'Writing it down', icon: PenLine },
  { value: 'A bit of both', icon: MessageCircle },
];
const MOODS = [
  { score: 5, label: 'Steady' },
  { score: 4, label: 'Mostly okay' },
  { score: 3, label: 'Mixed' },
  { score: 2, label: 'Heavy' },
  { score: 1, label: 'Very heavy' },
];
const COMFORT: Option[] = [
  { value: 'Slow breathing', icon: Wind },
  { value: 'Grounding my senses', icon: Sparkles },
  { value: 'Talking to someone', icon: Users },
  { value: 'Music or sound', icon: Music },
];

const Title = React.forwardRef<HTMLHeadingElement, { children: React.ReactNode; hint?: string }>(({ children, hint }, ref) => (
  <div>
    <h1 ref={ref} tabIndex={-1} className="outline-none text-[28px] leading-[1.2] font-semibold tracking-[-0.015em] break-soft">
      {children}
    </h1>
    {hint && <p className="mt-2 text-[16px] text-ink-2 break-soft">{hint}</p>}
  </div>
));

const Options: React.FC<{ value: string; options: Option[]; label: string; onSelect: (value: string) => void }> = ({
  value,
  options,
  label,
  onSelect,
}) => (
  <ChoiceGroup label={label}>
    {options.map((o) => (
      <Choice key={o.value} icon={o.icon} accent="sage" selected={value === o.value} onSelect={() => onSelect(o.value)}>
        {o.value}
      </Choice>
    ))}
  </ChoiceGroup>
);

const TOTAL = 6;

export const Onboarding: React.FC<OnboardingProps> = ({ user, onComplete }) => {
  const { t, language, setLanguage } = useLanguage();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    displayName: user.name,
    language,
    coping: '',
    lowTime: '',
    channel: '',
    baselineMood: 0,
    comfort: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const next = () => setStep((s) => Math.min(TOTAL - 1, s + 1));
  const pick = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    set(key, value);
    window.setTimeout(next, 260);
  };
  const chooseLanguage = (code: LanguageCode) => {
    set('language', code);
    setLanguage(code);
  };

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      onComplete(await saveProfile({ ...draft, completedAt: new Date().toISOString() }));
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'We couldn’t save that just now. Please try again.');
      setSaving(false);
    }
  };

  const firstName = (draft.displayName || user.name).trim().split(/\s+/)[0];

  return (
    <EntryShell>
      <div className="flex flex-col gap-6 pt-2">
        <div className="flex items-center gap-3">
          {step > 0 ? <IconButton icon={ArrowLeft} label={t('common.back')} onClick={() => setStep(step - 1)} /> : <span className="w-12" />}
          <div className="flex-1">
            <ProgressIndicator current={step + 1} total={TOTAL} accent="sage" label={`Question ${step + 1} of ${TOTAL}`} />
          </div>
        </div>

        <section key={step} className="flex flex-col gap-6 settle">
          {step === 0 && (
            <>
              <div>
                <Serif className="text-[20px] text-ink-2">a few gentle questions.</Serif>
                <Title ref={heading} hint="They help SAAHAS understand your own normal, so it can notice - kindly - when something shifts. Nothing here is a test.">
                  Let’s get to know you
                </Title>
              </div>
              <TextField label="What should we call you?" value={draft.displayName} onChange={(e) => set('displayName', e.target.value)} maxLength={80} />
              <div className="flex flex-col gap-2.5">
                <p className="text-[15px] font-semibold">Which language feels most comfortable?</p>
                <LanguageSwitcher value={draft.language} onChange={chooseLanguage} label="Language" />
              </div>
              <Button variant="accent" accent="sage" size="lg" full iconRight={ArrowRight} disabled={!draft.displayName.trim()} onClick={next}>
                {t('common.continue')}
              </Button>
            </>
          )}

          {step === 1 && (
            <>
              <Title ref={heading} hint="There’s no right answer.">When things feel heavy, what usually helps, {firstName}?</Title>
              <Options value={draft.coping} options={COPING} label="What usually helps" onSelect={(v) => pick('coping', v)} />
            </>
          )}

          {step === 2 && (
            <>
              <Title ref={heading} hint="So check-ins can come at a time that actually helps.">What time of day tends to feel hardest?</Title>
              <Options value={draft.lowTime} options={LOW_TIME} label="Hardest time of day" onSelect={(v) => pick('lowTime', v)} />
            </>
          )}

          {step === 3 && (
            <>
              <Title ref={heading} hint="You can always change your mind.">When you share, what feels more natural?</Title>
              <Options value={draft.channel} options={CHANNEL} label="How you like to share" onSelect={(v) => pick('channel', v)} />
            </>
          )}

          {step === 4 && (
            <>
              <Title ref={heading} hint="Just a soft sense of it. It’s your own baseline, never compared with anyone.">How has this past week felt?</Title>
              <ChoiceGroup label="How this past week felt">
                {MOODS.map((m) => (
                  <Choice key={m.score} accent="sage" selected={draft.baselineMood === m.score} onSelect={() => pick('baselineMood', m.score)}>
                    {m.label}
                  </Choice>
                ))}
              </ChoiceGroup>
            </>
          )}

          {step === 5 && (
            <>
              <Title ref={heading} hint="We’ll keep it close, so it’s one tap away when you need it.">What helps you feel safe and grounded?</Title>
              <Options value={draft.comfort} options={COMFORT} label="What helps you feel safe" onSelect={(v) => set('comfort', v)} />
              {error && <Notice tone="error">{error}</Notice>}
              <Button variant="accent" accent="sage" size="lg" full busy={saving} disabled={!draft.comfort} iconRight={ArrowRight} onClick={finish}>
                Enter SAAHAS
              </Button>
            </>
          )}

          {step > 0 && step < 5 && (
            <Button variant="ghost" onClick={next}>
              {t('common.skip')}
            </Button>
          )}
        </section>
      </div>
    </EntryShell>
  );
};
