import React, { Suspense, createContext, lazy, useCallback, useContext, useEffect, useState } from 'react';
import { CloudOff, Phone } from 'lucide-react';
import { SessionUser, guestUser, restoreSession, signOut } from './authStore';
import { clearSession, onSignedOut } from '../lib/api';
import { AuthMode, AuthScreen } from './AuthScreen';
import { Onboarding } from './Onboarding';
import { useLanguage } from '../i18n/LanguageProvider';
import { EntryShell } from '../survivor/entry/EntryShell';
import { Welcome } from '../survivor/entry/Welcome';
import { Button } from '../survivor/ui/Button';
import { Serif } from '../survivor/ui/primitives';

// The pitch page (demos only, at ?about) - loaded on demand so survivors never download it.
const LandingPage = lazy(() => import('../components/LandingPage').then((m) => ({ default: m.LandingPage })));

interface AuthContextValue {
  user: SessionUser;
  /** Signs out on the server too, then shows the sign-in screen. */
  logout: () => Promise<void>;
  /** Forgets the session on this device only (after Quick Exit), so getting back in needs a sign-in. */
  lock: () => void;
  /** Swaps in fresh account details, e.g. after a consent change. */
  updateUser: (user: SessionUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Read the signed-in user (and log out) from anywhere inside the app.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthGate>');
  return ctx;
}

type GateState = { status: 'loading' } | { status: 'offline' } | { status: 'ready'; user: SessionUser | null };

// Gate: shows sign-in/up when logged out, the gentle onboarding for a brand-new
// victim account, and only then the app itself.
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GateState>({ status: 'loading' });
  // Survivors start at a quiet welcome. The project pitch page (it explains the
  // Distress Score, so it must never be a survivor's first screen) is kept for
  // demos at ?about.
  // Counsellors have their own sign-in page at /staff.
  const [entry, setEntryState] = useState<'pitch' | 'welcome' | AuthMode>(() =>
    window.location.pathname.startsWith('/staff')
      ? 'staff'
      : new URLSearchParams(window.location.search).has('about')
        ? 'pitch'
        : 'welcome',
  );
  const setEntry = useCallback((next: 'pitch' | 'welcome' | AuthMode) => {
    const path = next === 'staff' ? '/staff' : '/';
    if (window.location.pathname !== path) window.history.replaceState(null, '', path + window.location.search);
    setEntryState(next);
  }, []);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', user: await restoreSession() });
    } catch {
      setState({ status: 'offline' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The backend stopped accepting the token: it expired, was signed out from
  // another device, or the account was deleted.
  useEffect(() => onSignedOut(() => setState({ status: 'ready', user: null })), []);

  const setUser = (user: SessionUser | null) => setState({ status: 'ready', user });

  if (state.status === 'loading') return <Splash />;
  if (state.status === 'offline') {
    return (
      <Offline
        onRetry={load}
        onSignInAgain={() => {
          clearSession();
          setUser(null);
        }}
      />
    );
  }

  const { user } = state;
  if (!user) {
    if (entry === 'pitch') {
      return (
        <Suspense fallback={<Splash />}>
          <LandingPage onEnter={() => setEntry('welcome')} />
        </Suspense>
      );
    }
    if (entry === 'welcome') {
      return (
        <Welcome
          onStart={() => setEntry('signup')}
          onSignIn={() => setEntry('signin')}
          onGuest={() => setUser(guestUser())}
          onStaff={() => setEntry('staff')}
        />
      );
    }
    return <AuthScreen mode={entry} onAuthenticated={setUser} onBack={() => setEntry('welcome')} onSwitch={setEntry} />;
  }
  if (user.role === 'victim' && !user.onboarded) return <Onboarding user={user} onComplete={setUser} />;

  const value: AuthContextValue = {
    user,
    logout: async () => {
      await signOut();
      setUser(null);
    },
    lock: () => {
      clearSession();
      setEntry('welcome');
      setUser(null);
    },
    updateUser: setUser,
  };

  // Keyed by account, so nothing from one person's session carries into the next
  return (
    <AuthContext.Provider key={user.id} value={value}>
      {children}
    </AuthContext.Provider>
  );
};

const Splash: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="sahaas grid place-items-center" role="status">
      <div className="flex flex-col items-center gap-5">
        <span aria-hidden className="w-14 h-14 rounded-full bg-sage/80 hush" />
        <Serif className="text-[20px] text-ink-2">{t('splash.opening')}</Serif>
      </div>
    </div>
  );
};

const Offline: React.FC<{ onRetry: () => void; onSignInAgain: () => void }> = ({ onRetry, onSignInAgain }) => {
  const { t } = useLanguage();
  return (
    <EntryShell>
      <div className="flex flex-col gap-6 pt-10">
        <CloudOff className="w-10 h-10 text-ink-2" aria-hidden />
        <div>
          <h1 className="text-[28px] leading-[1.2] font-semibold break-soft">{t('offline.title')}</h1>
          <p className="mt-3 text-[17px] text-ink-2 break-soft">{t('offline.sub')}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button href="tel:112" variant="accent" accent="coral" size="lg" icon={Phone}>112</Button>
          <Button href="tel:14416" variant="accent" accent="coral" size="lg" icon={Phone}>14416</Button>
        </div>
        <Button variant="solid" size="lg" full onClick={onRetry}>{t('offline.retry')}</Button>
        <Button variant="ghost" onClick={onSignInAgain}>{t('offline.signin')}</Button>
      </div>
    </EntryShell>
  );
};
