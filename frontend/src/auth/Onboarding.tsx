import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  MessageCircle,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  Music,
  Users,
  Wind,
  Heart,
  Sparkles,
  Mic,
  PenLine,
  Clock,
} from 'lucide-react';
import { SessionUser, OnboardingProfile, LanguageCode, saveProfile } from './authStore';

interface OnboardingProps {
  user: SessionUser;
  onComplete: (user: SessionUser) => void;
}

type Draft = Omit<OnboardingProfile, 'completedAt'>;

const LANGS: { code: LanguageCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
];

const COPING = [
  { value: 'Talking it out', icon: MessageCircle },
  { value: 'Quiet time alone', icon: Moon },
  { value: 'Staying busy', icon: Sparkles },
  { value: 'Prayer or faith', icon: Heart },
  { value: 'Listening to music', icon: Music },
];

const LOW_TIME = [
  { value: 'Mornings', icon: Sunrise },
  { value: 'Afternoons', icon: Sun },
  { value: 'Evenings', icon: Sunset },
  { value: 'Late at night', icon: Moon },
  { value: 'It varies', icon: Clock },
];

const CHANNEL = [
  { value: 'Speaking out loud', icon: Mic },
  { value: 'Writing it down', icon: PenLine },
  { value: 'A bit of both', icon: MessageCircle },
];

const MOODS = [
  { score: 1, label: 'Very heavy' },
  { score: 2, label: 'Heavy' },
  { score: 3, label: 'Mixed' },
  { score: 4, label: 'Mostly okay' },
  { score: 5, label: 'Steady' },
];

const COMFORT = [
  { value: 'Slow breathing', icon: Wind },
  { value: 'Grounding my senses', icon: Sparkles },
  { value: 'Talking to someone', icon: Users },
  { value: 'Music or sound', icon: Music },
];

const TOTAL_STEPS = 6;

export const Onboarding: React.FC<OnboardingProps> = ({ user, onComplete }) => {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>({
    displayName: user.name,
    language: 'en',
    coping: '',
    lowTime: '',
    channel: '',
    baselineMood: 0,
    comfort: '',
  });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  // Pick-and-advance for the single-select steps.
  const pick = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    set(key, value);
    setTimeout(next, 140);
  };

  const finish = () => {
    const profile: OnboardingProfile = { ...draft, completedAt: new Date().toISOString() };
    const updated = saveProfile(profile);
    onComplete(updated ?? { ...user, profile });
  };

  const firstName = (draft.displayName || user.name).split(' ')[0];

  const OptionButton: React.FC<{
    active: boolean;
    icon: React.ElementType;
    label: string;
    onClick: () => void;
  }> = ({ active, icon: Icon, label, onClick }) => (
    <button
      onClick={onClick}
      className={`w-full p-3.5 rounded-2xl border text-left text-sm font-medium transition-all active:scale-[0.99] flex items-center gap-3 ${
        active
          ? 'border-[#9c6743] bg-[#efe7d6] text-[#7a5a3f]'
          : 'border-[#e5dac4] bg-white hover:bg-[#f5f1e8] text-[#352e24]'
      }`}
    >
      <span
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          active ? 'bg-[#9c6743] text-white' : 'bg-[#efe7d6] text-[#9c6743]'
        }`}
      >
        <Icon className="w-4.5 h-4.5" />
      </span>
      <span className="flex-1">{label}</span>
      {active && <Check className="w-4 h-4 text-[#9c6743]" />}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#352e24] flex flex-col font-sans relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#e7d3b5]/50 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -left-24 w-80 h-80 rounded-full bg-[#9fafca]/20 blur-3xl pointer-events-none" />

      {/* Progress */}
      <div className="relative z-10 px-5 pt-5">
        <div className="max-w-md mx-auto flex items-center gap-3">
          {step > 1 ? (
            <button onClick={back} className="p-1.5 rounded-lg text-[#8a7d68] hover:bg-white/70" aria-label="Back">
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <span className="w-7" />
          )}
          <div className="flex-1 h-1.5 rounded-full bg-[#e5dac4] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#9c6743] transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold text-[#8a7d68] w-8 text-right">
            {step}/{TOTAL_STEPS}
          </span>
        </div>
      </div>

      <main className="relative z-10 flex-1 flex items-start justify-center px-4 py-6">
        <div className="w-full max-w-md animate-fadeIn" key={step}>
          {/* Step 1 — name + language */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#c8a97e] to-[#9c6743] flex items-center justify-center mx-auto shadow-md">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h1 className="text-2xl font-bold mt-4">Let’s get to know you</h1>
                <p className="text-sm text-[#5c5142] mt-1.5 leading-relaxed">
                  A few gentle questions help SAHAAS understand your own normal — so it can notice, kindly,
                  when something shifts. Nothing here is a test.
                </p>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-[#e5dac4] shadow-sm flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-[#5c5142]">What should we call you?</span>
                  <input
                    type="text"
                    value={draft.displayName}
                    onChange={(e) => set('displayName', e.target.value)}
                    placeholder="A name you feel safe with"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#f5f1e8] border border-[#e5dac4] text-sm text-[#352e24] placeholder-[#a89a83] outline-none focus:border-[#9c6743] focus:ring-2 focus:ring-[#9c6743]/20"
                  />
                </label>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-[#5c5142]">Which language feels most comfortable?</span>
                  <div className="grid grid-cols-3 gap-2">
                    {LANGS.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => set('language', l.code)}
                        className={`py-2 rounded-xl border text-sm font-semibold transition-all ${
                          draft.language === l.code
                            ? 'border-[#9c6743] bg-[#efe7d6] text-[#7a5a3f]'
                            : 'border-[#e5dac4] bg-white hover:bg-[#f5f1e8] text-[#352e24]'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={next}
                disabled={!draft.displayName.trim()}
                className="w-full py-3 rounded-2xl bg-[#9c6743] text-white font-semibold text-sm shadow-md hover:bg-[#835636] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 2 — coping */}
          {step === 2 && (
            <StepShell
              eyebrow="Understanding you"
              title={`When things feel heavy, what usually helps, ${firstName}?`}
              subtitle="There is no right answer — this simply helps us support you the way you like."
            >
              {COPING.map((o) => (
                <OptionButton key={o.value} active={draft.coping === o.value} icon={o.icon} label={o.value} onClick={() => pick('coping', o.value)} />
              ))}
            </StepShell>
          )}

          {/* Step 3 — low time */}
          {step === 3 && (
            <StepShell
              eyebrow="Your rhythm"
              title="What time of day tends to feel hardest?"
              subtitle="Knowing this lets SAHAAS check in gently, at a time that actually helps."
            >
              {LOW_TIME.map((o) => (
                <OptionButton key={o.value} active={draft.lowTime === o.value} icon={o.icon} label={o.value} onClick={() => pick('lowTime', o.value)} />
              ))}
            </StepShell>
          )}

          {/* Step 4 — channel */}
          {step === 4 && (
            <StepShell
              eyebrow="How you open up"
              title="When you share, what feels more natural?"
              subtitle="You can always change this later. We’ll lead with what’s easiest for you."
            >
              {CHANNEL.map((o) => (
                <OptionButton key={o.value} active={draft.channel === o.value} icon={o.icon} label={o.value} onClick={() => pick('channel', o.value)} />
              ))}
            </StepShell>
          )}

          {/* Step 5 — baseline mood */}
          {step === 5 && (
            <StepShell
              eyebrow="A gentle baseline"
              title="How has this past week felt for you?"
              subtitle="Just a soft sense of it. This becomes your personal baseline — never a score against anyone else."
            >
              <div className="flex flex-col gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m.score}
                    onClick={() => pick('baselineMood', m.score)}
                    className={`w-full p-3.5 rounded-2xl border text-left text-sm font-medium transition-all active:scale-[0.99] flex items-center gap-3 ${
                      draft.baselineMood === m.score
                        ? 'border-[#9c6743] bg-[#efe7d6] text-[#7a5a3f]'
                        : 'border-[#e5dac4] bg-white hover:bg-[#f5f1e8] text-[#352e24]'
                    }`}
                  >
                    <span className="flex gap-1 shrink-0">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span
                          key={i}
                          className={`w-2 h-6 rounded-full ${i <= m.score ? 'bg-[#9c6743]' : 'bg-[#e5dac4]'}`}
                        />
                      ))}
                    </span>
                    <span className="flex-1">{m.label}</span>
                    {draft.baselineMood === m.score && <Check className="w-4 h-4 text-[#9c6743]" />}
                  </button>
                ))}
              </div>
            </StepShell>
          )}

          {/* Step 6 — comfort + finish */}
          {step === 6 && (
            <StepShell
              eyebrow="Almost there"
              title="What helps you feel safe and grounded?"
              subtitle="We’ll keep this close, so support is one tap away when you need it."
            >
              <div className="flex flex-col gap-2">
                {COMFORT.map((o) => (
                  <OptionButton
                    key={o.value}
                    active={draft.comfort === o.value}
                    icon={o.icon}
                    label={o.value}
                    onClick={() => set('comfort', o.value)}
                  />
                ))}
              </div>
              <button
                onClick={finish}
                disabled={!draft.comfort}
                className="mt-4 w-full py-3 rounded-2xl bg-[#9c6743] text-white font-semibold text-sm shadow-md hover:bg-[#835636] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                <span>Enter my sanctuary</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </StepShell>
          )}
        </div>
      </main>
    </div>
  );
};

const StepShell: React.FC<{
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ eyebrow, title, subtitle, children }) => (
  <div className="flex flex-col gap-4">
    <div>
      <span className="text-xs font-bold uppercase tracking-wider text-[#9c6743]">{eyebrow}</span>
      <h1 className="text-xl font-bold text-[#352e24] mt-1 leading-snug">{title}</h1>
      <p className="text-sm text-[#5c5142] mt-1.5 leading-relaxed">{subtitle}</p>
    </div>
    <div className="flex flex-col gap-2">{children}</div>
  </div>
);
