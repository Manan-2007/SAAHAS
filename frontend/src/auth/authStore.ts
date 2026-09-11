// Sign-in against the SAHAAS backend (/auth, /me).
//
// The token itself lives in lib/api: sessionStorage only, never localStorage,
// so nothing outlives the browser session on a shared phone. Nothing about
// the account (name, answers, password) is kept in the browser.

import { ApiError, Consent, Me, api, clearSession, getToken, setToken } from '../lib/api';
import type { LanguageCode } from '../types';

export type { LanguageCode };

// A gentle "getting to know you" baseline, captured once at sign-up. It gives
// SAHAAS the person's OWN normal to measure future mood shifts against - the
// same baseline idea the Dynamic Distress Score relies on.
export interface OnboardingProfile {
  displayName: string;
  language: LanguageCode;
  coping: string;          // how they usually cope when things feel heavy
  lowTime: string;         // time of day they most often feel low
  channel: string;         // voice / text / both - preferred way to open up
  baselineMood: number;    // 1-5, how the past week has felt
  comfort: string;         // what helps them feel safe
  completedAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  // guest: using the app without an account - nothing is saved
  role: 'victim' | 'counsellor' | 'guest';
  username: string | null;
  language: LanguageCode;
  counsellor: string | null;
  consent: Partial<Consent>;
  hasPassword: boolean;
  onboarded: boolean;
}

export interface SignUpInput {
  name: string;
  username: string;
  password: string;
  consent: Consent;
}

export const MIN_PASSWORD_LENGTH = 8;       // matches the backend (monitoring/auth.py)

export class AuthError extends Error {}

const OFFLINE_MESSAGE = "We can't reach SAHAAS right now. Please check your connection and try again.";

function toUser(me: Me): SessionUser {
  return {
    id: me.user_id,
    name: me.name,
    role: me.role,
    username: me.username,
    language: me.language ?? 'en',
    counsellor: me.counsellor,
    consent: me.consent ?? {},
    hasPassword: me.has_password,
    onboarded: me.role !== 'victim' || me.profile !== null,
  };
}

// Backend errors become sentences a person can act on
function asAuthError(err: unknown, messages: Partial<Record<number, string>> = {}): AuthError {
  if (err instanceof AuthError) return err;
  if (err instanceof ApiError) return new AuthError(messages[err.status] ?? err.message);
  return new AuthError(OFFLINE_MESSAGE);
}

async function currentUser(): Promise<SessionUser> {
  return toUser(await api.me());
}

export async function signUp({ name, username, password, consent }: SignUpInput): Promise<SessionUser> {
  if (!name.trim()) throw new AuthError('Please share a name we can greet you by.');
  if (username.trim().length < 3) throw new AuthError('Please choose a username with at least 3 characters.');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(`Please use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
  }
  if (!consent.data_storage) throw new AuthError('An account needs permission to save your check-ins.');
  try {
    await api.register({
      name: name.trim(),
      language: 'en',
      consent,
      username: username.trim(),
      password,
    });
    // Keep a session token, not the registration's access token: a session
    // expires, shows up under "Where I'm signed in", and signing out ends it.
    const session = await api.login(username.trim(), password);
    setToken(session.token);
    return await currentUser();
  } catch (err) {
    clearSession();
    throw asAuthError(err, { 409: 'That username is already taken. Please try another one.' });
  }
}

export async function signIn(username: string, password: string): Promise<SessionUser> {
  if (!username.trim() || !password) throw new AuthError('Please enter your username and password.');
  try {
    const res = await api.login(username.trim(), password);
    setToken(res.token);
    return await currentUser();
  } catch (err) {
    clearSession();
    throw asAuthError(err, { 401: 'Incorrect username or password.' });
  }
}

// For accounts made with an access token (manage.py, or registration without a password)
export async function signInWithToken(token: string): Promise<SessionUser> {
  if (!token.trim()) throw new AuthError('Please paste your access token.');
  setToken(token.trim());
  try {
    return await currentUser();
  } catch (err) {
    clearSession();
    throw asAuthError(err, { 401: "That access token didn't work. Please check it and try again." });
  }
}

// null when there's no usable token. Throws when the backend can't be reached,
// so the caller can offer a retry instead of silently signing the person out.
export async function restoreSession(): Promise<SessionUser | null> {
  if (!getToken()) return null;
  try {
    return await currentUser();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export async function signOut(): Promise<void> {
  try {
    if (getToken()) await api.logout();
  } catch {
    /* already signed out on the server, or offline: forget the token either way */
  }
  clearSession();
}

export async function saveProfile(profile: OnboardingProfile): Promise<SessionUser> {
  try {
    await api.saveProfile({
      display_name: profile.displayName.trim() || null,
      language: profile.language,
      coping: profile.coping || null,
      low_time: profile.lowTime || null,
      channel: profile.channel || null,
      baseline_mood: profile.baselineMood || null,
      comfort: profile.comfort || null,
    });
    return await currentUser();
  } catch (err) {
    throw asAuthError(err);
  }
}

export async function refreshUser(): Promise<SessionUser> {
  return currentUser();
}

// Using SAHAAS without an account: chat and voice work, nothing is stored.
export function guestUser(): SessionUser {
  return {
    id: 'guest',
    name: 'Friend',
    role: 'guest',
    username: null,
    language: 'en',
    counsellor: null,
    consent: {},
    hasPassword: false,
    onboarded: true,
  };
}
