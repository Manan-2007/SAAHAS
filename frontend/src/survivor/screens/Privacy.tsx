import React, { useEffect, useState } from 'react';
import { KeyRound, LogOut, Mic, Play, Smartphone, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { MIN_PASSWORD_LENGTH } from '../../auth/authStore';
import { useLanguage } from '../../i18n/LanguageProvider';
import type { Consent, Gender, Recording, SessionInfo, UiStyle } from '../../lib/api';
import { ApiError } from '../../lib/api';
import type { LanguageCode } from '../../types';
import { useSurvivor } from '../SurvivorContext';
import { account, errorText, saveLanguage } from '../data/survivorData';
import { CONSENT_OPTIONS, consentOn } from '../data/consent';
import { Button, IconButton } from '../ui/Button';
import { ConsentCard, LanguageSwitcher, TextField, ThemeSwitcher } from '../ui/forms';
import { Choice, ChoiceGroup, Notice, ScreenHeader, Stack } from '../ui/primitives';

// Privacy you can understand: what SAHAAS keeps, in plain words, each with a
// real switch. The escape hatches - sign out a phone someone else has, forget
// the conversation, delete everything - are on the page, not buried.

type OptionalConsent = Exclude<keyof Consent, 'data_storage'>;

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
  { id: 'nonbinary', label: 'Non-binary / other' },
  { id: 'prefer_not', label: 'Prefer not to say' },
];

const STYLES: { id: UiStyle; label: string; hint: string }[] = [
  { id: 'warm', label: 'Warm & encouraging', hint: 'a kind line each day, and gentle wins' },
  { id: 'calm', label: 'Simple & calm', hint: 'quiet and plain' },
];

function deviceName(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const os = /iPhone|iPad/.test(ua) ? 'iPhone or iPad' : /Android/.test(ua) ? 'Android phone'
    : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows computer' : /Linux/.test(ua) ? 'Linux computer' : 'device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : '';
  return browser ? `${browser} on ${os}` : os.charAt(0).toUpperCase() + os.slice(1);
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="flex flex-col gap-3">
    <div>
      <h2 className="text-[18px] font-semibold">{title}</h2>
      {hint && <p className="text-sm text-ink-2 break-soft">{hint}</p>}
    </div>
    {children}
  </section>
);

export const Privacy: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const { user, updateUser, logout, lock } = useAuth();
  const { back, isVictim, isGuest } = useSurvivor();
  const [consent, setConsent] = useState<Partial<Consent>>(user.consent);
  const [error, setError] = useState<string | null>(null);
  const [langSaving, setLangSaving] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [savingMe, setSavingMe] = useState(false);
  const [creds, setCreds] = useState({ username: '', password: '', busy: false, done: false });
  const [pw, setPw] = useState({ open: false, current: '', next: '', busy: false, done: false });
  const [confirm, setConfirm] = useState<'forget' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotten, setForgotten] = useState(false);

  useEffect(() => {
    if (isGuest) return;
    account.sessions().then(setSessions).catch(() => setSessions([]));
  }, [isGuest]);

  useEffect(() => {
    if (!consent.store_recordings) {
      setRecordings(null);
      return;
    }
    account.recordings().then(setRecordings).catch(() => setRecordings([]));
  }, [consent.store_recordings]);

  // Each played recording is an object URL: free it when replaced or on leaving.
  useEffect(() => () => {
    if (playing) URL.revokeObjectURL(playing.url);
  }, [playing]);

  const changeLanguage = async (next: LanguageCode) => {
    const previous = language;
    setLanguage(next);
    if (!isVictim) return;
    setLangSaving(true);
    setError(null);
    try {
      await saveLanguage(next);
      updateUser({ ...user, language: next });
    } catch (err) {
      setLanguage(previous);
      setError(errorText(err));
    } finally {
      setLangSaving(false);
    }
  };

  const toggle = async (key: OptionalConsent) => {
    if (key === 'ivrs_calls' && !user.phone && !consent.ivrs_calls) {
      setError('Add your phone number below first, so there’s somewhere to call.');
      return;
    }
    const next = !consentOn(consent, key);
    setError(null);
    setConsent((c) => ({ ...c, [key]: next }));
    try {
      const res = await account.updateConsent({ [key]: next });
      setConsent(res.consent);
      updateUser({ ...user, consent: res.consent });
    } catch (err) {
      setConsent((c) => ({ ...c, [key]: !next }));
      setError(errorText(err));
    }
  };

  const saveSettings = async (body: { gender?: Gender; ui_style?: UiStyle; phone?: string; clear_phone?: boolean }) => {
    setError(null);
    setSavingMe(true);
    try {
      const me = await account.updateSettings(body);
      updateUser({ ...user, gender: me.gender, uiStyle: me.ui_style, phone: me.phone, consent: me.consent ?? user.consent });
      if (me.consent) setConsent(me.consent);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSavingMe(false);
    }
  };

  const play = async (rec: Recording) => {
    setError(null);
    try {
      setPlaying({ id: rec.id, url: await account.playRecording(rec.id) });
    } catch (err) {
      setError(errorText(err));
    }
  };

  const removeRecording = async (rec: Recording) => {
    try {
      await account.deleteRecording(rec.id);
      setRecordings((list) => list?.filter((r) => r.id !== rec.id) ?? null);
      if (playing?.id === rec.id) setPlaying(null);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const signOutDevice = async (s: SessionInfo) => {
    try {
      await account.revokeSession(s.id);
      setSessions((list) => list?.filter((x) => x.id !== s.id) ?? null);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const addCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creds.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Please use at least ${MIN_PASSWORD_LENGTH} characters for the password.`);
      return;
    }
    setError(null);
    setCreds((c) => ({ ...c, busy: true }));
    try {
      const res = await account.setCredentials(creds.username.trim(), creds.password);
      setCreds({ username: '', password: '', busy: false, done: true });
      updateUser({ ...user, username: res.username, hasPassword: true });
    } catch (err) {
      setCreds((c) => ({ ...c, busy: false }));
      setError(err instanceof ApiError && err.status === 409 ? 'That username is taken. Try another.' : errorText(err));
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next.length < MIN_PASSWORD_LENGTH) {
      setError(`Please use at least ${MIN_PASSWORD_LENGTH} characters for the new password.`);
      return;
    }
    setError(null);
    setPw((p) => ({ ...p, busy: true }));
    try {
      await account.changePassword(pw.current, pw.next);
      setPw({ open: false, current: '', next: '', busy: false, done: true });
      account.sessions().then(setSessions).catch(() => {});
    } catch (err) {
      setPw((p) => ({ ...p, busy: false }));
      setError(err instanceof ApiError && err.status === 401 ? 'Your current password isn’t right.' : errorText(err));
    }
  };

  const confirmAction = async () => {
    setBusy(true);
    setError(null);
    try {
      if (confirm === 'forget') {
        await account.forgetConversation();
        setForgotten(true);
        setConfirm(null);
      } else {
        await account.deleteEverything();
        lock();
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="gap-7">
      <ScreenHeader title={t('support.privacy')} onBack={back} />

      {!isGuest && (
        <p className="text-[15px] text-ink-2 -mt-3 break-soft">
          Signed in as <span className="text-ink font-semibold">{user.username ?? user.name}</span>
          {user.counsellor && <> · your counsellor is {user.counsellor}</>}
        </p>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <Section title="Language" hint={langSaving ? t('common.saving') : 'SAHAAS speaks and replies in this language.'}>
        <LanguageSwitcher value={language} onChange={changeLanguage} label="Language" disabled={langSaving} />
        {language !== 'en' && (
          <p className="text-sm text-ink-2">Some screens are still in English while translations are reviewed.</p>
        )}
      </Section>

      <Section title={t('theme.title')} hint={t('theme.hint')}>
        <ThemeSwitcher
          label={t('theme.title')}
          labels={{ system: t('theme.system'), light: t('theme.light'), dark: t('theme.dark') }}
        />
      </Section>

      {isGuest ? (
        <Section title="What SAHAAS keeps">
          <Notice action={<Button variant="ghost" onClick={lock}>{t('home.guestCta')}</Button>}>
            Nothing. Without an account, what you say isn’t saved, and it’s gone when you leave.
          </Notice>
        </Section>
      ) : (
        <div className="flex flex-col gap-7">
          <Section title="What SAHAAS keeps" hint="Change any of these whenever you like.">
            {CONSENT_OPTIONS.filter((o) => !o.required).map((o) => (
              <ConsentCard
                key={o.key}
                title={o.title}
                hint={o.later}
                on={consentOn(consent, o.key)}
                onToggle={() => toggle(o.key as OptionalConsent)}
              />
            ))}
          </Section>

          {consent.store_recordings && (
            <Section title="My recordings">
              {recordings === null ? (
                <p className="text-[15px] text-ink-2 hush">{t('common.loading')}</p>
              ) : recordings.length === 0 ? (
                <p className="text-[15px] text-ink-2">No recordings kept yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {recordings.map((r) => (
                    <li key={r.id} className="rounded-card bg-surface border border-line p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <Mic className="w-5 h-5 text-lilac shrink-0" aria-hidden />
                        <span className="flex-1 text-[15px] break-soft">
                          {r.kind === 'voice_note' ? 'Voice note' : 'Voice check-in'} · {when(r.at)}
                          {r.duration_s ? ` · ${Math.round(r.duration_s)}s` : ''}
                        </span>
                        <IconButton icon={Play} label="Play" onClick={() => play(r)} />
                        <IconButton icon={Trash2} label="Delete this recording" onClick={() => removeRecording(r)} />
                      </div>
                      {playing?.id === r.id && <audio src={playing.url} controls autoPlay className="w-full" />}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          <Section title="Where you’re signed in" hint="If someone else might have one of these phones, sign it out here.">
            {sessions === null ? (
              <p className="text-[15px] text-ink-2 hush">{t('common.loading')}</p>
            ) : sessions.length === 0 ? (
              <p className="text-[15px] text-ink-2">Only here.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <li key={s.id} className="rounded-card bg-surface border border-line px-4 py-3 flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-ink-2 shrink-0" aria-hidden />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold break-soft">
                        {deviceName(s.device)}
                        {s.current && <span className="font-normal text-ink-2"> · this phone</span>}
                      </span>
                      <span className="block text-sm text-ink-2">last used {when(s.last_seen_at)}</span>
                    </span>
                    {!s.current && (
                      <Button variant="quiet" onClick={() => signOutDevice(s)}>
                        Sign out
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {isVictim && (
            <Section title="You & the app">
              <ChoiceGroup label="How do you identify?" className="grid grid-cols-2 gap-2">
                {GENDERS.map((g) => (
                  <Choice key={g.id} selected={user.gender === g.id} disabled={savingMe} onSelect={() => saveSettings({ gender: g.id })} accent="sage">
                    <span className="text-[15px]">{g.label}</span>
                  </Choice>
                ))}
              </ChoiceGroup>
              <ChoiceGroup label="How SAHAAS feels" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STYLES.map((st) => (
                  <Choice key={st.id} selected={user.uiStyle === st.id} disabled={savingMe} hint={st.hint} onSelect={() => saveSettings({ ui_style: st.id })} accent="sage">
                    <span className="text-[15px]">{st.label}</span>
                  </Choice>
                ))}
              </ChoiceGroup>
              <div className="flex items-end gap-2">
                <TextField
                  className="flex-1"
                  label="Phone number"
                  optionalLabel="for check-in calls"
                  type="tel"
                  maxLength={20}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Only if it’s safe for us to call"
                  autoComplete="tel"
                />
                <Button variant="quiet" size="lg" disabled={savingMe || !phone.trim() || phone.trim() === (user.phone ?? '')} onClick={() => saveSettings({ phone: phone.trim() })}>
                  Save
                </Button>
              </div>
              {user.phone && (
                <Button
                  variant="ghost"
                  className="self-start"
                  disabled={savingMe}
                  onClick={() => {
                    setPhone('');
                    saveSettings({ clear_phone: true });
                  }}
                >
                  Remove my phone number
                </Button>
              )}
            </Section>
          )}

          {!user.hasPassword ? (
            <Section
              title="Add a password"
              hint="Right now this account lives only on this device - lose it, and you lose your journey. A username and password let you sign back in anywhere."
            >
              {creds.done ? (
                <Notice>Password added. You can now sign in on any phone.</Notice>
              ) : (
                <form onSubmit={addCredentials} className="flex flex-col gap-3">
                  <TextField label="Username" hint="Not your real name." autoComplete="username" autoCapitalize="none" value={creds.username} onChange={(e) => setCreds((c) => ({ ...c, username: e.target.value }))} />
                  <TextField label="Password" type="password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} autoComplete="new-password" value={creds.password} onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))} />
                  <Button type="submit" variant="solid" size="lg" busy={creds.busy} disabled={!creds.username.trim() || !creds.password}>
                    Add a password
                  </Button>
                </form>
              )}
            </Section>
          ) : (
            <Section title="Password">
              {pw.done && <Notice>Password changed. Other devices were signed out.</Notice>}
              {pw.open ? (
                <form onSubmit={changePassword} className="flex flex-col gap-3">
                  <TextField label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
                  <TextField label="New password" type="password" hint={`At least ${MIN_PASSWORD_LENGTH} characters. Other devices will be signed out; this one stays.`} autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
                  <Button type="submit" variant="solid" size="lg" busy={pw.busy} disabled={!pw.current}>
                    Change password
                  </Button>
                </form>
              ) : (
                <Button variant="quiet" icon={KeyRound} className="self-start" onClick={() => setPw((p) => ({ ...p, open: true, done: false }))}>
                  Change my password
                </Button>
              )}
            </Section>
          )}

          <Section title="Leaving">
            <Button variant="quiet" size="lg" icon={LogOut} full onClick={() => logout()}>
              Sign out
            </Button>
            {consent.store_messages && (
              <Button variant="quiet" size="lg" full onClick={() => setConfirm('forget')} disabled={forgotten}>
                {forgotten ? 'Our conversation has been forgotten' : 'Forget our conversation'}
              </Button>
            )}
            <Button variant="quiet" size="lg" icon={Trash2} full onClick={() => setConfirm('delete')}>
              Delete all my data
            </Button>
            {confirm && (
              <div role="alertdialog" aria-labelledby="confirm-title" className="rounded-card bg-raised border border-line-strong p-4 flex flex-col gap-3 soft-fade">
                <p id="confirm-title" className="text-[16px] font-semibold">
                  {confirm === 'delete' ? 'Delete everything, for good?' : 'Forget what we’ve talked about?'}
                </p>
                <p className="text-[15px] text-ink-2 break-soft">
                  {confirm === 'delete'
                    ? 'This erases your account, check-ins, recordings and everything your counsellor sees. It can’t be undone.'
                    : 'The stored chat and voice conversation is erased. Your check-ins stay.'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="solid" busy={busy} onClick={confirmAction}>
                    {confirm === 'delete' ? 'Yes, delete' : 'Yes, forget'}
                  </Button>
                  <Button variant="quiet" onClick={() => setConfirm(null)}>
                    Keep it
                  </Button>
                </div>
              </div>
            )}
          </Section>
        </div>
      )}
    </Stack>
  );
};
