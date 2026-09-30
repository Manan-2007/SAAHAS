import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, BriefcaseMedical, ShieldCheck } from 'lucide-react';
import { AuthError, MIN_PASSWORD_LENGTH, SessionUser, WrongDoorError, guestUser, signIn, signUp } from './authStore';
import type { Consent, Gender } from '../lib/api';
import { useLanguage } from '../i18n/LanguageProvider';
import { EntryShell } from '../survivor/entry/EntryShell';
import { CONSENT_OPTIONS, DEFAULT_CONSENT } from '../survivor/data/consent';
import { Button, IconButton } from '../survivor/ui/Button';
import { ConsentCard, TextField } from '../survivor/ui/forms';
import { Choice, ChoiceGroup, Notice, ProgressIndicator, Serif } from '../survivor/ui/primitives';

export type AuthMode = 'signup' | 'signin' | 'staff';

interface AuthScreenProps {
  mode: AuthMode;
  onAuthenticated: (user: SessionUser) => void;
  onBack: () => void;
  onSwitch: (mode: AuthMode) => void;
}

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
  { id: 'nonbinary', label: 'Non-binary / other' },
  { id: 'prefer_not', label: 'Prefer not to say' },
];

const failure = (err: unknown) => (err instanceof AuthError ? err.message : 'Something went wrong. Please try again.');

export const AuthScreen: React.FC<AuthScreenProps> = (props) =>
  props.mode === 'signup' ? <SignUp {...props} /> : props.mode === 'staff' ? <StaffSignIn {...props} /> : <SignIn {...props} />;

// ---------------------------------------------------------------- sign up: three calm steps

const SignUp: React.FC<AuthScreenProps> = ({ onAuthenticated, onBack, onSwitch }) => {
  const { t, language } = useLanguage();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [consent, setConsent] = useState<Consent>(DEFAULT_CONSENT);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const back = () => {
    setError(null);
    if (step === 0) onBack();
    else setStep(step - 1);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContinue) return;
    if (step < 2) {
      setError(null);
      setStep(step + 1);
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onAuthenticated(await signUp({ name, username, password, consent, gender, phone, language }));
    } catch (err) {
      setError(failure(err));
      setBusy(false);
    }
  };

  const canContinue = step === 0 ? !!name.trim() && !!gender : step === 1 ? consent.data_storage : !!username.trim() && !!password;

  return (
    <EntryShell>
      <form onSubmit={submit} className="flex flex-col gap-6 pt-2" noValidate>
        <div className="flex items-center gap-3 settle">
          <IconButton icon={ArrowLeft} label={t('common.back')} onClick={back} />
          <div className="flex-1">
            <ProgressIndicator current={step + 1} total={3} accent="sun" label={`Step ${step + 1} of 3`} />
          </div>
        </div>

        {step === 0 && (
          <section key="about" className="flex flex-col gap-6 settle">
            <div>
              <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.015em]">What should we call you?</h1>
              <Serif className="mt-2 text-[19px] text-ink-2">any name you feel safe with.</Serif>
            </div>
            <TextField
              label="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
              maxLength={80}
              placeholder="It doesn’t have to be your real one"
            />
            <div className="flex flex-col gap-2.5">
              <p id="gender" className="text-[15px] font-semibold">How do you identify?</p>
              <ChoiceGroup label="How do you identify?" className="grid grid-cols-2 gap-2">
                {GENDERS.map((g) => (
                  <Choice key={g.id} selected={gender === g.id} onSelect={() => setGender(g.id)} accent="sun">
                    <span className="text-[15px]">{g.label}</span>
                  </Choice>
                ))}
              </ChoiceGroup>
              <p className="text-sm text-ink-2">Kept private and encrypted. It sets how SAHAAS speaks to you, and you can change it later.</p>
            </div>
          </section>
        )}

        {step === 1 && (
          <section key="consent" className="flex flex-col gap-5 settle">
            <div>
              <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.015em]">What SAHAAS may keep</h1>
              <p className="mt-2 text-[17px] text-ink-2">You decide. Everything here can be changed later, and deleted any time.</p>
            </div>
            <div className="flex flex-col gap-2.5">
              {CONSENT_OPTIONS.map((o) => (
                <ConsentCard
                  key={o.key}
                  title={o.title}
                  hint={o.hint}
                  required={o.required}
                  on={consent[o.key]}
                  onToggle={() => setConsent((c) => ({ ...c, [o.key]: !c[o.key] }))}
                />
              ))}
            </div>
            {!consent.data_storage && (
              <Notice
                action={
                  <Button variant="ghost" onClick={() => onAuthenticated(guestUser())}>
                    {t('welcome.guest')}
                  </Button>
                }
              >
                Without this there’s no account. You can still use SAHAAS without one - chat and voice work, and nothing is saved.
              </Notice>
            )}
          </section>
        )}

        {step === 2 && (
          <section key="account" className="flex flex-col gap-5 settle">
            <div>
              <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.015em]">A way back in</h1>
              <p className="mt-2 text-[17px] text-ink-2">So you can sign in again, on this phone or another.</p>
            </div>
            <TextField
              label="Username"
              hint="Anything you’ll remember - not your real name."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              maxLength={60}
            />
            <TextField
              label="Password"
              type="password"
              hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <TextField
              label="Phone number"
              optionalLabel="(optional)"
              type="tel"
              hint={consent.ivrs_calls ? 'Needed for the check-in calls you chose.' : 'Only if it’s safe for us to call.'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              maxLength={20}
            />
          </section>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        <div className="flex flex-col gap-3">
          <Button type="submit" variant="accent" accent="sun" size="lg" full busy={busy} disabled={!canContinue} iconRight={ArrowRight}>
            {step < 2 ? t('common.continue') : 'Create my space'}
          </Button>
          {step === 2 && (
            <p className="flex items-start gap-2 text-sm text-ink-2">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
              Your details are encrypted. Only your counsellor sees your check-ins.
            </p>
          )}
          {step === 0 && (
            <Button variant="ghost" onClick={() => onSwitch('signin')}>
              {t('welcome.signin')}
            </Button>
          )}
        </div>
      </form>
    </EntryShell>
  );
};

// ---------------------------------------------------------------- sign in (survivors)

const SignIn: React.FC<AuthScreenProps> = ({ onAuthenticated, onBack, onSwitch }) => {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wrongDoor, setWrongDoor] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setWrongDoor(false);
    try {
      onAuthenticated(await signIn(username, password, 'survivor'));
    } catch (err) {
      setWrongDoor(err instanceof WrongDoorError);
      setError(failure(err));
      setBusy(false);
    }
  };

  return (
    <EntryShell>
      <form onSubmit={submit} className="flex flex-col gap-6 pt-2" noValidate>
        <div className="settle">
          <IconButton icon={ArrowLeft} label={t('common.back')} onClick={onBack} />
        </div>
        <div className="settle">
          <Serif as="h1" className="text-[38px] leading-[1.1] text-ink">welcome back.</Serif>
          <p className="mt-2 text-[17px] text-ink-2">Step back into your space.</p>
        </div>
        <div className="flex flex-col gap-4 settle" style={{ ['--i' as string]: 1 }}>
          <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && (
          <Notice
            tone="error"
            action={wrongDoor ? <Button variant="ghost" onClick={() => onSwitch('staff')}>Go to counsellor sign-in</Button> : undefined}
          >
            {error}
          </Notice>
        )}
        <div className="flex flex-col gap-2">
          <Button type="submit" variant="solid" size="lg" full busy={busy}>
            Sign in
          </Button>
          <Button variant="ghost" onClick={() => onSwitch('signup')}>
            New here? {t('welcome.start')}
          </Button>
        </div>
      </form>
    </EntryShell>
  );
};

// ---------------------------------------------------------------- sign in (counsellors)

// Its own page (/staff). There is deliberately no public counsellor sign-up:
// a counsellor account sees survivors' scores, so a colleague adds new ones
// from Settings -> Team (or an administrator runs manage.py create-counsellor).
const StaffSignIn: React.FC<AuthScreenProps> = ({ onAuthenticated, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onAuthenticated(await signIn(username, password, 'counsellor'));
    } catch (err) {
      setError(failure(err));
      setBusy(false);
    }
  };

  return (
    <div className="sahaas min-h-dvh grid lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-surface border-r border-line">
        <span className="text-[15px] font-extrabold tracking-[0.2em]">SAHAAS <span className="ml-1 font-semibold tracking-normal text-ink-2">counsellor</span></span>
        <div className="max-w-[420px]">
          <h2 className="text-[28px] leading-[1.2] font-semibold">See who needs you first, and why.</h2>
          <ul className="mt-6 flex flex-col gap-3 text-[15px] text-ink-2">
            <li>Your caseload sorted by who may need help soonest.</li>
            <li>Every alert explains which signals raised it.</li>
            <li>Summaries of how people are doing, never their private words.</li>
          </ul>
        </div>
        <p className="text-sm text-ink-2">Survivors never see scores. Everything here is for the people supporting them.</p>
      </aside>
      <main className="flex flex-col justify-center px-4 sm:px-6 py-10">
        <form onSubmit={submit} className="w-full max-w-[400px] mx-auto flex flex-col gap-6" noValidate>
          <div className="lg:hidden text-[15px] font-extrabold tracking-[0.2em]">SAHAAS <span className="ml-1 font-semibold tracking-normal text-ink-2">counsellor</span></div>
          <div>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink-2">
              <BriefcaseMedical className="w-4 h-4" aria-hidden /> For counsellors and case workers
            </span>
            <h1 className="mt-2 text-[32px] leading-[1.15] font-semibold tracking-[-0.015em]">Counsellor sign in</h1>
          </div>
          <div className="flex flex-col gap-4">
            <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" variant="solid" size="lg" full busy={busy}>
            Sign in
          </Button>
          <p className="text-sm text-ink-2">
            No account yet? A colleague who already uses SAHAAS can add you from <strong className="text-ink">Settings → Team</strong>.
          </p>
          <Button variant="ghost" onClick={onBack}>
            Not a counsellor? Go to the SAHAAS app
          </Button>
        </form>
      </main>
    </div>
  );
};
