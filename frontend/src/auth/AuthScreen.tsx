import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck, Loader2, Heart, AtSign, KeyRound, Check } from 'lucide-react';
import {
  AuthError,
  MIN_PASSWORD_LENGTH,
  SessionUser,
  guestUser,
  signIn,
  signInWithToken,
  signUp,
} from './authStore';
import { Consent, clearSession } from '../lib/api';

interface AuthScreenProps {
  onAuthenticated: (user: SessionUser) => void;
}

// What each consent means, in plain words. data_storage is the only one an
// account needs; the rest are the person's choice and can change later.
const CONSENT_OPTIONS: { key: keyof Consent; label: string; hint: string; required?: boolean }[] = [
  {
    key: 'data_storage',
    label: 'Save my check-ins',
    hint: 'So your counsellor can notice when things get harder. Needed for an account.',
    required: true,
  },
  {
    key: 'voice_analysis',
    label: 'Notice how my voice sounds',
    hint: 'Only the tone, to understand how you are feeling.',
  },
  {
    key: 'store_messages',
    label: 'Keep what I write in chats',
    hint: 'Off unless you choose it. Kept encrypted.',
  },
  {
    key: 'store_recordings',
    label: 'Keep recordings of my voice check-ins',
    hint: 'Off unless you choose it. Only you and your counsellor can play them.',
  },
];

const DEFAULT_CONSENT: Consent = {
  data_storage: true,
  voice_analysis: true,
  store_messages: false,
  store_recordings: false,
};

const INPUT_CLASS =
  'w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#f5f1e8] border border-[#e5dac4] text-sm text-[#352e24] placeholder-[#a89a83] outline-none focus:border-[#9c6743] focus:ring-2 focus:ring-[#9c6743]/20';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [useToken, setUseToken] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setTokenInput] = useState('');
  const [consent, setConsent] = useState<Consent>(DEFAULT_CONSENT);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const user = isSignup
        ? await signUp({ name, username, password, consent })
        : useToken
        ? await signInWithToken(token)
        : await signIn(username, password);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setUseToken(false);
    setError(null);
  };

  // A discreet safety exit, available even before sign-in.
  const leaveQuickly = () => {
    clearSession();
    window.location.replace('https://www.google.com/search?q=weather+today');
  };

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#352e24] flex flex-col font-sans relative overflow-hidden">
      {/* Soft ambient auras */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#e7d3b5]/50 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -left-24 w-96 h-96 rounded-full bg-[#9fafca]/25 blur-3xl pointer-events-none" />

      {/* Top bar: brand + quick exit */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-[#9c6743]">SAHAAS</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 text-[#7a5a3f] text-[11px] font-semibold">
            <Lock className="w-3 h-3" /> Private &amp; Safe
          </span>
        </div>
        <button
          onClick={leaveQuickly}
          className="text-xs font-semibold text-[#8a7d68] hover:text-[#5c5142] transition-colors"
          title="Leave to a neutral page quickly"
        >
          Leave quickly
        </button>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-sm md:max-w-md">
          {/* Welcome */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#c8a97e] to-[#9c6743] flex items-center justify-center mx-auto shadow-md">
              <Heart className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#352e24] mt-4">
              {isSignup ? 'Welcome to your sanctuary' : 'Welcome back'}
            </h1>
            <p className="text-sm text-[#5c5142] mt-1.5 leading-relaxed">
              {isSignup
                ? 'A quiet, private space that moves at your pace. Let’s set it up gently.'
                : 'Step back into your calm, protected space.'}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-white/70 p-1 rounded-2xl border border-[#e5dac4] text-sm font-semibold mb-4">
            <button
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 rounded-xl transition-all ${
                isSignup ? 'bg-[#9c6743] text-white shadow-xs' : 'text-[#5c5142] hover:text-[#352e24]'
              }`}
            >
              Create account
            </button>
            <button
              onClick={() => switchMode('signin')}
              className={`flex-1 py-2 rounded-xl transition-all ${
                !isSignup ? 'bg-[#9c6743] text-white shadow-xs' : 'text-[#5c5142] hover:text-[#352e24]'
              }`}
            >
              Sign in
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl p-6 shadow-sm border border-[#e5dac4] flex flex-col gap-3.5"
          >
            {isSignup && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[#5c5142]">What should we call you?</span>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a7d68]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name or a name you feel safe with"
                    autoComplete="nickname"
                    maxLength={80}
                    className={INPUT_CLASS}
                  />
                </div>
              </label>
            )}

            {useToken ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[#5c5142]">Access token</span>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a7d68]" />
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="The token you were given"
                    autoComplete="off"
                    className={INPUT_CLASS}
                  />
                </div>
              </label>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-[#5c5142]">Username</span>
                  <div className="relative">
                    <AtSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a7d68]" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={isSignup ? 'Anything you’ll remember, not your real name' : 'Your username'}
                      autoComplete="username"
                      autoCapitalize="none"
                      maxLength={60}
                      className={INPUT_CLASS}
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-[#5c5142]">Password</span>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a7d68]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isSignup ? `At least ${MIN_PASSWORD_LENGTH} characters` : 'Your password'}
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      className={`${INPUT_CLASS} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a7d68] hover:text-[#5c5142]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </label>
              </>
            )}

            {isSignup && (
              <fieldset className="flex flex-col gap-2 pt-1">
                <legend className="text-xs font-semibold text-[#5c5142] mb-1.5">What SAHAAS may keep</legend>
                {CONSENT_OPTIONS.map((o) => {
                  const on = consent[o.key];
                  return (
                    <button
                      key={o.key}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={`${o.label}${o.required ? ' (required)' : ''}`}
                      onClick={() => setConsent((c) => ({ ...c, [o.key]: !c[o.key] }))}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                        on ? 'border-[#9c6743] bg-[#efe7d6]/70' : 'border-[#e5dac4] bg-white hover:bg-[#f5f1e8]'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                          on ? 'bg-[#9c6743] border-[#9c6743] text-white' : 'border-[#c8b89c] bg-white'
                        }`}
                      >
                        {on && <Check className="w-3 h-3" />}
                      </span>
                      <span className="flex flex-col">
                        <span className="text-xs font-semibold text-[#352e24]">
                          {o.label}
                          {o.required && <span className="text-[#9c6743]"> *</span>}
                        </span>
                        <span className="text-[11px] text-[#8a7d68] leading-snug">{o.hint}</span>
                      </span>
                    </button>
                  );
                })}
                {!consent.data_storage && (
                  <p className="text-[11px] text-[#7a5a3f] leading-snug">
                    Without this there's no account. You can still{' '}
                    <button type="button" onClick={() => onAuthenticated(guestUser())} className="font-semibold underline">
                      continue without one
                    </button>
                    : chat and voice work, and nothing is saved.
                  </p>
                )}
              </fieldset>
            )}

            {error && (
              <p role="alert" className="text-xs text-[#93000a] bg-[#ffdad6]/60 border border-[#ffdad6] rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || (isSignup && !consent.data_storage)}
              className="mt-1 w-full py-3 rounded-2xl bg-[#9c6743] text-white font-semibold text-sm shadow-md hover:bg-[#835636] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{isSignup ? 'Create my sanctuary' : 'Sign in'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {!isSignup && (
              <button
                type="button"
                onClick={() => {
                  setUseToken((t) => !t);
                  setError(null);
                }}
                className="text-[11px] font-semibold text-[#8a7d68] hover:text-[#5c5142]"
              >
                {useToken ? 'Use a username and password instead' : 'I have an access token instead'}
              </button>
            )}

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#8a7d68] mt-1 text-center">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              Your details are encrypted. Only your assigned counsellor sees your check-ins.
            </p>
          </form>

          <p className="text-center text-xs text-[#8a7d68] mt-4">
            {isSignup ? 'Already have a space here? ' : 'New to SAHAAS? '}
            <button
              onClick={() => switchMode(isSignup ? 'signin' : 'signup')}
              className="font-semibold text-[#9c6743] hover:underline"
            >
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <p className="text-center text-xs text-[#8a7d68] mt-2">
            <button onClick={() => onAuthenticated(guestUser())} className="font-semibold hover:underline">
              Continue without an account
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};
