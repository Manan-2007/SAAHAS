import React, { useEffect, useState } from 'react';
import { X, Shield, Smartphone, Trash2, LogOut, Play, KeyRound, Loader2, Mic, Check } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { MIN_PASSWORD_LENGTH } from '../auth/authStore';
import { ApiError, Consent, Recording, SessionInfo, api, fetchAudioUrl } from '../lib/api';

type OptionalConsent = Exclude<keyof Consent, 'data_storage'>;

const TOGGLES: { key: OptionalConsent; label: string; hint: string }[] = [
  {
    key: 'voice_analysis',
    label: 'Notice how my voice sounds',
    hint: 'When off, voice check-ins still work, but nothing about them is saved.',
  },
  {
    key: 'store_messages',
    label: 'Keep what I write in chats',
    hint: 'Kept encrypted. When off, only a sense of how you were feeling is saved, not your words.',
  },
  {
    key: 'store_recordings',
    label: 'Keep recordings of my voice check-ins',
    hint: 'Only you and your counsellor can play them.',
  },
];

// "Chrome on Android phone" is enough to recognise a device; the raw user agent isn't
function deviceName(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const os = /iPhone|iPad/.test(ua) ? 'iPhone or iPad' : /Android/.test(ua) ? 'Android phone'
    : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows computer' : /Linux/.test(ua) ? 'Linux computer' : 'device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : '';
  return browser ? `${browser} on ${os}` : os.charAt(0).toUpperCase() + os.slice(1);
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : "We can't reach SAHAAS right now. Please try again.";

const SECTION = 'bg-white rounded-2xl p-4 border border-[#e5dac4] flex flex-col gap-3';
const HEADING = 'text-xs font-bold uppercase tracking-wider text-[#9c6743]';

export const PrivacySettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user, updateUser, logout, lock } = useAuth();
  const [consent, setConsent] = useState<Partial<Consent>>(user.consent);
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState({ open: false, current: '', next: '', done: false, busy: false });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.sessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    if (!consent.store_recordings) {
      setRecordings(null);
      return;
    }
    api.recordings().then(setRecordings).catch(() => setRecordings([]));
  }, [consent.store_recordings]);

  // Each played recording is an object URL; free it when it's replaced or the panel closes
  useEffect(() => () => {
    if (playing) URL.revokeObjectURL(playing.url);
  }, [playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = async (key: OptionalConsent) => {
    const next = !consent[key];
    setError(null);
    setConsent((c) => ({ ...c, [key]: next }));
    try {
      const res = await api.updateConsent({ [key]: next });
      setConsent(res.consent);
      updateUser({ ...user, consent: res.consent });
    } catch (err) {
      setConsent((c) => ({ ...c, [key]: !next }));
      setError(errorText(err));
    }
  };

  const play = async (rec: Recording) => {
    setError(null);
    try {
      setPlaying({ id: rec.id, url: await fetchAudioUrl(`/me/recordings/${rec.id}/audio`) });
    } catch (err) {
      setError(errorText(err));
    }
  };

  const removeRecording = async (rec: Recording) => {
    try {
      await api.deleteRecording(rec.id);
      setRecordings((list) => list?.filter((r) => r.id !== rec.id) ?? null);
      if (playing?.id === rec.id) setPlaying(null);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const signOutDevice = async (s: SessionInfo) => {
    try {
      await api.revokeSession(s.id);
      setSessions((list) => list?.filter((x) => x.id !== s.id) ?? null);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.next.length < MIN_PASSWORD_LENGTH) {
      setError(`Please use at least ${MIN_PASSWORD_LENGTH} characters for the new password.`);
      return;
    }
    setError(null);
    setPassword((p) => ({ ...p, busy: true }));
    try {
      await api.changePassword(password.current, password.next);
      setPassword({ open: false, current: '', next: '', done: true, busy: false });
      api.sessions().then(setSessions).catch(() => {});
    } catch (err) {
      setPassword((p) => ({ ...p, busy: false }));
      setError(err instanceof ApiError && err.status === 401 ? 'Your current password is not right.' : errorText(err));
    }
  };

  const deleteEverything = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteMe();
      lock();
    } catch (err) {
      setDeleting(false);
      setError(errorText(err));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#352e24]/30 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Privacy and account"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-[#f5f1e8] rounded-t-3xl sm:rounded-3xl p-4 flex flex-col gap-3 shadow-xl animate-fadeIn"
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#9c6743]" />
            <h2 className="text-lg font-bold text-[#352e24]">Privacy &amp; account</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#8a7d68] hover:bg-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="px-1 text-xs text-[#5c5142]">
          Signed in as <strong>{user.username ?? user.name}</strong>
          {user.counsellor && <> · your counsellor is {user.counsellor}</>}
        </p>

        {error && (
          <p role="alert" className="text-xs text-[#93000a] bg-[#ffdad6]/60 border border-[#ffdad6] rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {/* What SAHAAS keeps */}
        <section className={SECTION}>
          <h3 className={HEADING}>What SAHAAS keeps</h3>
          {TOGGLES.map((t) => {
            const on = !!consent[t.key];
            return (
              <button
                key={t.key}
                role="switch"
                aria-checked={on}
                onClick={() => toggle(t.key)}
                className="flex items-start gap-3 text-left"
              >
                <span className={`mt-0.5 w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${on ? 'bg-[#9c6743]' : 'bg-[#d9ccb2]'}`}>
                  <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-[#352e24]">{t.label}</span>
                  <span className="text-[11px] text-[#8a7d68] leading-snug">{t.hint}</span>
                </span>
              </button>
            );
          })}
        </section>

        {/* Recordings */}
        {consent.store_recordings && (
          <section className={SECTION}>
            <h3 className={HEADING}>My recordings</h3>
            {recordings === null ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#9c6743]" />
            ) : recordings.length === 0 ? (
              <p className="text-xs text-[#5c5142]">No recordings kept yet.</p>
            ) : (
              recordings.map((r) => (
                <div key={r.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-[#9c6743] shrink-0" />
                    <span className="flex-1 text-xs text-[#352e24]">
                      {r.kind === 'voice_note' ? 'Voice note' : 'Voice check-in'} · {when(r.at)}
                      {r.duration_s ? ` · ${Math.round(r.duration_s)}s` : ''}
                    </span>
                    <button onClick={() => play(r)} className="p-1.5 rounded-lg text-[#9c6743] hover:bg-[#efe7d6]" aria-label="Play">
                      <Play className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeRecording(r)} className="p-1.5 rounded-lg text-[#8a7d68] hover:text-[#ba1a1a] hover:bg-red-50" aria-label="Delete recording">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {playing?.id === r.id && <audio src={playing.url} controls autoPlay className="w-full h-9" />}
                </div>
              ))
            )}
          </section>
        )}

        {/* Devices */}
        <section className={SECTION}>
          <h3 className={HEADING}>Where I'm signed in</h3>
          <p className="text-[11px] text-[#8a7d68] -mt-1.5">If someone else might have your phone, sign it out here.</p>
          {sessions === null ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#9c6743]" />
          ) : sessions.length === 0 ? (
            <p className="text-xs text-[#5c5142]">No other sign-ins.</p>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#9c6743] shrink-0" />
                <span className="flex-1 flex flex-col">
                  <span className="text-xs font-semibold text-[#352e24]">
                    {deviceName(s.device)} {s.current && <span className="text-[#9c6743]">· this device</span>}
                  </span>
                  <span className="text-[11px] text-[#8a7d68]">Last used {when(s.last_seen_at)}</span>
                </span>
                {!s.current && (
                  <button onClick={() => signOutDevice(s)} className="text-xs font-semibold text-[#93000a] hover:underline">
                    Sign out
                  </button>
                )}
              </div>
            ))
          )}
        </section>

        {/* Password */}
        {user.hasPassword && (
          <section className={SECTION}>
            <h3 className={HEADING}>Password</h3>
            {password.done && (
              <p className="text-xs text-[#7a5a3f] flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Password changed. Other devices were signed out.
              </p>
            )}
            {password.open ? (
              <form onSubmit={changePassword} className="flex flex-col gap-2">
                <input
                  type="password"
                  value={password.current}
                  onChange={(e) => setPassword((p) => ({ ...p, current: e.target.value }))}
                  placeholder="Current password"
                  autoComplete="current-password"
                  className="w-full px-3 py-2 rounded-xl bg-[#f5f1e8] border border-[#e5dac4] text-sm outline-none focus:border-[#9c6743]"
                />
                <input
                  type="password"
                  value={password.next}
                  onChange={(e) => setPassword((p) => ({ ...p, next: e.target.value }))}
                  placeholder={`New password (at least ${MIN_PASSWORD_LENGTH} characters)`}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 rounded-xl bg-[#f5f1e8] border border-[#e5dac4] text-sm outline-none focus:border-[#9c6743]"
                />
                <p className="text-[11px] text-[#8a7d68]">Other devices will be signed out. This one stays signed in.</p>
                <button
                  type="submit"
                  disabled={password.busy || !password.current}
                  className="py-2 rounded-xl bg-[#9c6743] text-white text-sm font-semibold disabled:opacity-50"
                >
                  {password.busy ? 'Changing…' : 'Change password'}
                </button>
              </form>
            ) : (
              <button
                onClick={() => setPassword((p) => ({ ...p, open: true, done: false }))}
                className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-[#9c6743] hover:underline"
              >
                <KeyRound className="w-3.5 h-3.5" /> Change my password
              </button>
            )}
          </section>
        )}

        {/* Leave */}
        <section className={SECTION}>
          <button onClick={() => logout()} className="self-start inline-flex items-center gap-1.5 text-sm font-semibold text-[#352e24] hover:text-[#9c6743]">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
          {confirmDelete ? (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-[#fff1ef] border border-[#ffdad6]">
              <p className="text-xs text-[#5c1a14] leading-relaxed">
                This erases your account, check-ins, recordings and everything your counsellor sees, for good. It can't be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={deleteEverything}
                  disabled={deleting}
                  className="flex-1 py-2 rounded-xl bg-[#ba1a1a] text-white text-xs font-semibold disabled:opacity-60"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete everything'}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-xl bg-white text-xs font-semibold text-[#352e24] border border-[#e5dac4]">
                  Keep my account
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="self-start inline-flex items-center gap-1.5 text-sm font-semibold text-[#93000a] hover:underline">
              <Trash2 className="w-4 h-4" /> Delete all my data
            </button>
          )}
        </section>
      </div>
    </div>
  );
};
