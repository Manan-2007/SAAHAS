// SAHAAS backend client: the sign-in token, authenticated requests, and the
// monitoring API (accounts, check-ins, the counsellor dashboard).
//
// The token lives in sessionStorage only - never localStorage - so it ends
// with the browser session, and Quick Exit wipes it: victims may share phones.
// In dev, Vite proxies these routes to the backend; for a separately hosted
// backend set VITE_API_URL.

import type { LanguageCode, WellBeingMetric } from '../types';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export const httpUrl = (path: string) => `${API_BASE}${path}`;
export const wsUrl = (path: string) =>
  `${(API_BASE || window.location.origin).replace(/^http/, 'ws')}${path}`;

// ---------------------------------------------------------------- session

const TOKEN_KEY = 'sahaas_token';
let memoryToken: string | null = null;    // when sessionStorage is blocked (some private modes)

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setToken(token: string): void {
  memoryToken = token;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* kept in memory only: the session lasts while this page is open */
  }
}

/** Forgets the token and anything else this tab stored (sign-out, Quick Exit). */
export function clearSession(): void {
  memoryToken = null;
  try {
    sessionStorage.clear();
  } catch {
    /* nothing stored */
  }
}

const signedOutListeners = new Set<() => void>();

/** Told when the backend stops accepting the token: expired, revoked from another device, or account deleted. */
export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => {
    signedOutListeners.delete(listener);
  };
}

/** The token was refused: drop it and send the person back to sign-in. */
export function expireSession(): void {
  if (!getToken()) return;
  clearSession();
  signedOutListeners.forEach((listener) => listener());
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------- requests

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function detailOf(data: unknown, status: number): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  // FastAPI validation errors: [{msg: "..."}, ...]
  if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg;
  return `Request failed (${status})`;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  // A 401 that means "wrong current password", not "signed out"
  keepSessionOn401?: boolean;
}

async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, auth = true, keepSessionOn401 = false } = options;
  const headers: Record<string, string> = auth ? authHeaders() : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(httpUrl(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Only if the refused token is still the current one (not already cleared by Quick Exit)
  if (res.status === 401 && headers.Authorization && !keepSessionOn401 &&
      headers.Authorization === authHeaders().Authorization) {
    expireSession();
  }
  return res;
}

export async function apiFetch<T>(path: string, options?: RequestOptions): Promise<T> {
  const res = await send(path, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, detailOf(data, res.status));
  return data as T;
}

/** Recordings need the auth header, so they're fetched as a blob and played from an object URL. */
export async function fetchAudioUrl(path: string): Promise<string> {
  const res = await send(path);
  if (!res.ok) throw new ApiError(res.status, detailOf(await res.json().catch(() => null), res.status));
  return URL.createObjectURL(await res.blob());
}

// ---------------------------------------------------------------- shapes

export type Role = 'victim' | 'counsellor';
export type Trend = WellBeingMetric['trend'];

export interface Consent {
  data_storage: boolean;
  voice_analysis: boolean;
  store_messages: boolean;
  store_recordings: boolean;
}

export interface OnboardingAnswers {
  coping: string | null;
  low_time: string | null;
  channel: string | null;
  baseline_mood: number | null;
  comfort: string | null;
  completed_at?: string;
}

export interface Me {
  user_id: string;
  role: Role;
  name: string;
  language: LanguageCode;
  consent: Partial<Consent>;
  counsellor: string | null;
  created_at: string;
  username: string | null;
  has_password: boolean;
  signed_in_with: 'session' | 'access_token';
  profile: OnboardingAnswers | null;
}

export interface RegisterBody {
  name: string;
  language: LanguageCode;
  consent: Consent;
  username?: string;
  password?: string;
}

export interface AuthResult {
  token: string;
  user_id: string;
  role: Role;
}

export interface Wellbeing {
  stress: Trend;
  energy: Trend;
  fatigue: Trend;
  message: string;
  has_data: boolean;
}

export type EventKind = 'hearing' | 'fir' | 'chargesheet' | 'compensation' | 'counselling' | 'other';

export interface CaseEvent {
  id: number;
  date: string;            // YYYY-MM-DD
  kind: EventKind;
  title: string;
  days_until: number;
}

export interface DueCheckin {
  instrument: string;
  name: string;
  due: boolean;
  last_completed_at: string | null;
  next_due_at: string | null;
  interval_days: number;
}

export interface Questionnaire {
  id: string;
  name: string;
  language: string;
  stem: string;
  items: { number: number; text: string }[];
  options: { value: number; label: string }[];
}

export interface SubmitResult {
  saved: boolean;
  crisis: boolean;
  crisis_message: string | null;
  wellbeing: Wellbeing;
}

export interface SessionInfo {
  id: number;
  device: string | null;
  started_at: string;
  last_seen_at: string;
  expires_at: string;
  current: boolean;
}

export interface Recording {
  id: string;
  at: string;
  kind: 'voice_note' | 'voice_checkin';
  content_type: string;
  bytes: number;
  duration_s: number | null;
  detail: { emotion?: string | null; voiced_seconds?: number | null; transcript?: string | null } | null;
}

// Counsellor views (see backend/backend.md section 3)

export type Tier = 'stable' | 'watch' | 'elevated' | 'high';

export interface TrendInfo {
  direction: 'rising' | 'falling' | 'steady' | 'not_enough_data';
  change_7d: number | null;
  slope_per_week: number | null;
  points: number;
}

export interface CaseloadRow {
  user_id: string;
  name: string;
  case_ref: string | null;
  language: LanguageCode;
  score: number | null;
  tier: Tier | null;
  crisis: boolean;
  confidence: number | null;
  trend: TrendInfo;
  open_alerts: number;
  last_contact_at: string | null;
  next_event: CaseEvent | null;
}

export type ScoreComponent = 'questionnaires' | 'text' | 'voice' | 'engagement';

export interface LatestScore {
  score: number;
  tier: Tier;
  crisis: boolean;
  confidence: number;      // 0-1: share of the signals that had data
  updated_at: string;
  components: Partial<Record<ScoreComponent, number>>;
  crisis_reasons?: string[];
}

export type AlertLevel = 'crisis' | 'high' | 'watch';
export type AlertReason = 'crisis_signal' | 'high_distress' | 'rising_distress' | 'gone_quiet' | 'upcoming_event';

export interface Alert {
  id: number;
  user_id: string;
  victim_name: string;
  at: string;
  level: AlertLevel;
  reason: AlertReason;
  message: string;
  status: 'open' | 'acknowledged' | 'resolved';
  handled_by: string | null;
  handled_at: string | null;
  note: string | null;
}

export interface VictimDetail {
  user_id: string;
  name: string;
  case_ref: string | null;
  phone: string | null;
  language: LanguageCode;
  consent: Partial<Consent>;
  created_at: string;
  last_contact_at: string | null;
  latest: LatestScore | null;
  trend: TrendInfo;
  questionnaires: {
    id: number;
    instrument: string;
    name: string;
    total: number;
    max_score: number;
    severity: string;
    flags: string[];
    at: string;
  }[];
  alerts: Alert[];
  events: CaseEvent[];
}

export interface Timeline {
  scores: { at: string; score: number; tier: Tier; crisis: boolean }[];
}

// ---------------------------------------------------------------- endpoints

const json = (method: string, body?: unknown, extra: Partial<RequestOptions> = {}): RequestOptions =>
  ({ method, body, ...extra });

export const api = {
  // accounts
  register: (body: RegisterBody) => apiFetch<AuthResult>('/auth/register', json('POST', body, { auth: false })),
  login: (username: string, password: string) =>
    apiFetch<AuthResult>('/auth/login', json('POST', { username, password }, { auth: false })),
  logout: () => apiFetch<{ signed_out: number }>('/auth/logout', json('POST', { all_devices: false })),
  me: () => apiFetch<Me>('/me'),
  saveProfile: (body: Partial<OnboardingAnswers> & { display_name: string | null; language: LanguageCode }) =>
    apiFetch<{ profile: OnboardingAnswers; name: string; language: LanguageCode }>('/me/profile', json('PUT', body)),
  updateConsent: (changes: Partial<Omit<Consent, 'data_storage'>>) =>
    apiFetch<{ consent: Consent }>('/me/consent', json('PATCH', changes)),
  deleteMe: () => apiFetch<{ deleted: boolean; recordings_deleted: number }>('/me', json('DELETE')),
  sessions: () => apiFetch<SessionInfo[]>('/me/sessions'),
  revokeSession: (id: number) => apiFetch<{ revoked: boolean }>(`/me/sessions/${id}`, json('DELETE')),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ changed: boolean; other_sessions_signed_out: number }>('/me/password',
      json('POST', { current_password: currentPassword, new_password: newPassword }, { keepSessionOn401: true })),

  // victim screens
  wellbeing: () => apiFetch<Wellbeing>('/me/wellbeing'),
  events: () => apiFetch<CaseEvent[]>('/me/events'),
  due: () => apiFetch<DueCheckin[]>('/me/due'),
  questionnaire: (instrument: string, lang: LanguageCode) =>
    apiFetch<Questionnaire>(`/questionnaires/${encodeURIComponent(instrument)}?lang=${lang}`, { auth: false }),
  submitQuestionnaire: (instrument: string, answers: number[]) =>
    apiFetch<SubmitResult>(`/me/questionnaires/${encodeURIComponent(instrument)}`, json('POST', { answers })),
  recordings: () => apiFetch<Recording[]>('/me/recordings'),
  deleteRecording: (id: string) => apiFetch<{ deleted: boolean }>(`/me/recordings/${id}`, json('DELETE')),

  // counsellor dashboard
  caseload: () => apiFetch<CaseloadRow[]>('/counsellor/victims'),
  victim: (id: string) => apiFetch<VictimDetail>(`/counsellor/victims/${id}`),
  timeline: (id: string, days = 30) => apiFetch<Timeline>(`/counsellor/victims/${id}/timeline?days=${days}`),
  alerts: (status: 'open' | 'acknowledged' | 'resolved' | 'all' = 'open') =>
    apiFetch<Alert[]>(`/counsellor/alerts?status=${status}`),
  acknowledgeAlert: (id: number) => apiFetch<Alert>(`/counsellor/alerts/${id}/acknowledge`, json('POST')),
  resolveAlert: (id: number, note?: string) =>
    apiFetch<Alert>(`/counsellor/alerts/${id}/resolve`, json('POST', { note: note ?? null })),
  addEvent: (victimId: string, event: { kind: EventKind; date: string; title: string }) =>
    apiFetch<CaseEvent>(`/counsellor/victims/${victimId}/events`, json('POST', event)),
  victimRecordings: (victimId: string) => apiFetch<Recording[]>(`/counsellor/victims/${victimId}/recordings`),
};
