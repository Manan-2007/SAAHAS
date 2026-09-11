// Lightweight client-side auth for the SAAHAS prototype.
//
// IMPORTANT: this is DEMO-grade auth. The demo account store lives in
// localStorage (passwords only as salted SHA-256 hashes, never plain text) so a
// signed-up user can sign in again. The ACTIVE SESSION lives in sessionStorage,
// per the project safety rule (frontend session never in localStorage): it does
// not persist across browser sessions, so the app never silently auto-logs-in on
// a shared or abuser-controlled device.
// A production deployment MUST replace this with the backend's real token auth.

export type LanguageCode = 'en' | 'hi' | 'pa';

// A gentle "getting to know you" baseline, captured once at sign-up. It gives
// SAAHAS the person's OWN normal to measure future mood shifts against — the
// same baseline idea the Dynamic Distress Score relies on.
export interface OnboardingProfile {
  displayName: string;
  language: LanguageCode;
  coping: string;          // how they usually cope when things feel heavy
  lowTime: string;         // time of day they most often feel low
  channel: string;         // voice / text / both — preferred way to open up
  baselineMood: number;    // 1-5, how the past week has felt
  comfort: string;         // what helps them feel safe
  completedAt: string;
}

export interface Account {
  id: string;
  name: string;
  email: string;
  salt: string;
  passHash: string;
  createdAt: string;
  profile: OnboardingProfile | null;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  profile: OnboardingProfile | null;
}

const ACCOUNTS_KEY = 'saahas_accounts_v1';
const SESSION_KEY = 'saahas_session_v1';

type AccountMap = Record<string, Account>; // keyed by lowercased email

function readAccounts(): AccountMap {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as AccountMap) : {};
  } catch {
    return {};
  }
}

function writeAccounts(map: AccountMap): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable (private mode etc.) — auth simply won't persist */
  }
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  (globalThis.crypto || ({} as Crypto)).getRandomValues?.(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function toSessionUser(a: Account): SessionUser {
  return { id: a.id, name: a.name, email: a.email, profile: a.profile };
}

export class AuthError extends Error {}

export async function signUp(name: string, email: string, password: string): Promise<SessionUser> {
  const key = email.trim().toLowerCase();
  if (!name.trim()) throw new AuthError('Please share a name we can greet you by.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) throw new AuthError('Please enter a valid email address.');
  if (password.length < 6) throw new AuthError('Please use at least 6 characters for your password.');

  const accounts = readAccounts();
  if (accounts[key]) throw new AuthError('An account with this email already exists. Try signing in.');

  const salt = randomSalt();
  const passHash = await hashPassword(password, salt);
  const account: Account = {
    id: `u_${Date.now().toString(36)}`,
    name: name.trim(),
    email: key,
    salt,
    passHash,
    createdAt: new Date().toISOString(),
    profile: null,
  };
  accounts[key] = account;
  writeAccounts(accounts);
  setSession(key);
  return toSessionUser(account);
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const key = email.trim().toLowerCase();
  const accounts = readAccounts();
  const account = accounts[key];
  if (!account) throw new AuthError('No account found for this email. Please sign up first.');
  const hash = await hashPassword(password, account.salt);
  if (hash !== account.passHash) throw new AuthError('That password does not match. Please try again.');
  setSession(key);
  return toSessionUser(account);
}

export function setSession(email: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, email.toLowerCase());
  } catch {
    /* ignore */
  }
}

export function signOut(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function getCurrentUser(): SessionUser | null {
  try {
    const email = sessionStorage.getItem(SESSION_KEY);
    if (!email) return null;
    const account = readAccounts()[email];
    return account ? toSessionUser(account) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: OnboardingProfile): SessionUser | null {
  try {
    const email = sessionStorage.getItem(SESSION_KEY);
    if (!email) return null;
    const accounts = readAccounts();
    const account = accounts[email];
    if (!account) return null;
    account.profile = profile;
    if (profile.displayName.trim()) account.name = profile.displayName.trim();
    accounts[email] = account;
    writeAccounts(accounts);
    return toSessionUser(account);
  } catch {
    return null;
  }
}
