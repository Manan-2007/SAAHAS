import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck, Loader2, Heart } from 'lucide-react';
import { SessionUser, signIn, signUp, AuthError } from './authStore';

interface AuthScreenProps {
  onAuthenticated: (user: SessionUser) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        ? await signUp(name, email, password)
        : await signIn(email, password);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError(null);
  };

  // A discreet safety exit, available even before sign-in.
  const leaveQuickly = () => {
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
                    autoComplete="name"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#f5f1e8] border border-[#e5dac4] text-sm text-[#352e24] placeholder-[#a89a83] outline-none focus:border-[#9c6743] focus:ring-2 focus:ring-[#9c6743]/20"
                  />
                </div>
              </label>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#5c5142]">Email</span>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a7d68]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#f5f1e8] border border-[#e5dac4] text-sm text-[#352e24] placeholder-[#a89a83] outline-none focus:border-[#9c6743] focus:ring-2 focus:ring-[#9c6743]/20"
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
                  placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#f5f1e8] border border-[#e5dac4] text-sm text-[#352e24] placeholder-[#a89a83] outline-none focus:border-[#9c6743] focus:ring-2 focus:ring-[#9c6743]/20"
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

            {error && (
              <p className="text-xs text-[#93000a] bg-[#ffdad6]/60 border border-[#ffdad6] rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
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

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#8a7d68] mt-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Your details stay private on this device. No one is notified.
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
        </div>
      </main>
    </div>
  );
};
