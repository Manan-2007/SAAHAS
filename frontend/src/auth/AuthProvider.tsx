import React, { createContext, useContext, useState } from 'react';
import { SessionUser, getCurrentUser, signOut } from './authStore';
import { AuthScreen } from './AuthScreen';
import { Onboarding } from './Onboarding';

interface AuthContextValue {
  user: SessionUser;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Read the signed-in user (and log out) from anywhere inside the app.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthGate>');
  return ctx;
}

// Gate: shows sign-in/up when logged out, the gentle onboarding for a brand-new
// user, and only then the app itself.
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(() => getCurrentUser());

  if (!user) {
    return <AuthScreen onAuthenticated={setUser} />;
  }

  if (!user.profile) {
    return <Onboarding user={user} onComplete={setUser} />;
  }

  const logout = () => {
    signOut();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
};
