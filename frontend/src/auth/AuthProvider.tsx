import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import { SessionUser, restoreSession, signOut } from './authStore';
import { clearSession, onSignedOut } from '../lib/api';
import { AuthScreen } from './AuthScreen';
import { Onboarding } from './Onboarding';
import { LandingPage } from '../components/LandingPage';

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
  // Show the marketing landing page first; "Enter SAHAAS" reveals sign-in.
  const [showAuth, setShowAuth] = useState(false);

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
    return showAuth ? (
      <AuthScreen onAuthenticated={setUser} />
    ) : (
      <LandingPage onEnter={() => setShowAuth(true)} />
    );
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

const Splash: React.FC = () => (
  <div className="min-h-screen bg-[#f5f1e8] flex items-center justify-center">
    <div className="flex flex-col items-center gap-3 text-[#9c6743]">
      <Loader2 className="w-7 h-7 animate-spin" />
      <span className="text-sm font-semibold">Opening your space…</span>
    </div>
  </div>
);

const Offline: React.FC<{ onRetry: () => void; onSignInAgain: () => void }> = ({ onRetry, onSignInAgain }) => (
  <div className="min-h-screen bg-[#f5f1e8] text-[#352e24] flex items-center justify-center px-4">
    <div className="w-full max-w-sm bg-white rounded-3xl p-6 border border-[#e5dac4] shadow-sm flex flex-col items-center text-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-[#efe7d6] text-[#9c6743] flex items-center justify-center">
        <WifiOff className="w-6 h-6" />
      </div>
      <h1 className="text-lg font-bold">We can't reach SAHAAS right now</h1>
      <p className="text-sm text-[#5c5142] leading-relaxed">
        Please check your connection. If you need help right now, call 112 (emergency) or Tele-MANAS 14416.
      </p>
      <button
        onClick={onRetry}
        className="mt-1 w-full py-3 rounded-2xl bg-[#9c6743] text-white font-semibold text-sm shadow-md hover:bg-[#835636] transition-all"
      >
        Try again
      </button>
      <button onClick={onSignInAgain} className="text-xs font-semibold text-[#9c6743] hover:underline">
        Sign in again
      </button>
    </div>
  </div>
);
