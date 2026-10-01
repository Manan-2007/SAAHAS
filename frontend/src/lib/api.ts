// SAAHAS backend client: the sign-in token, authenticated requests, and the
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
  // The assistant may tell the counsellor how conversations went - a summary, never the words.
  share_insights: boolean;
  // Phone me if I miss a check-in (needs a phone number).
  ivrs_calls: boolean;
}

export type Gender = 'woman' | 'man' | 'nonbinary' | 'prefer_not';
// 'warm': more encouraging, softer colours (the default for women); 'calm': the plain calm style.
export type UiStyle = 'warm' | 'calm';

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
  gender: Gender | null;
  ui_style: UiStyle;
  phone: string | null;
  has_duress?: boolean;
}

export interface RegisterBody {
  name: string;
  language: LanguageCode;
  consent: Consent;
  username?: string;
  password?: string;
  gender?: Gender;
  phone?: string | null;
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

export type EventKind =
  | 'hearing' | 'fir' | 'chargesheet' | 'compensation' | 'counselling' | 'other'
  // case-aware distress (backend.md §5): the justice calendar
  | 'bail_hearing' | 'parole' | 'adjournment' | 'trial_end';

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

/** One stored turn of the conversation, from the chat or a voice call. */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  at: string;
  channel: 'chat' | 'voice';
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
  gender?: Gender | null;
  latest_reading?: Reading | null;
  peak_24h?: { level: number | null; label: DistressLabel | null; count: number };
  open_issues?: number;
  unread_messages?: number;
  open_requests?: number;
}

export type ScoreComponent = 'questionnaires' | 'text' | 'voice' | 'engagement' | 'case_pressure';

// The "why" behind each signal (backend.md §5c). Engagement carries how quiet
// the person has gone — the strongest signal that someone is withdrawing.
export interface ScoreDetails {
  engagement?: {
    days_since_last_contact?: number;
    // 'slower' | 'faster' | 'steady' — how fast they come back now against their
    // own baseline. Absent until there are enough contacts on both sides of the
    // 7-day line. There is no message_length_trend: it would need the stored
    // message text, which most people never consent to keep.
    reply_latency_trend?: 'slower' | 'faster' | 'steady';
    missed_checkins?: number;   // 0-3 full questionnaires overdue
  };
  // The shape the backend actually sends. Each key is absent when that pressure
  // is not present, which is why a quiet docket scores nothing rather than calm.
  case_pressure?: {
    next_hearing?: { date: string; kind: EventKind; days_until: number; points: number };
    adjournments?: { count: number; window_days: number; points: number };
    unpaid_entitlements?: { count: number; points: number };
  };
  [component: string]: Record<string, unknown> | undefined;
}

export interface LatestScore {
  score: number;
  tier: Tier;
  crisis: boolean;
  confidence: number;      // 0-1: share of the signals that had data
  updated_at: string;
  components: Partial<Record<ScoreComponent, number>>;
  details?: ScoreDetails;
  crisis_reasons?: string[];
}

export type AlertLevel = 'crisis' | 'high' | 'watch';
export type AlertReason =
  | 'crisis_signal' | 'high_distress' | 'rising_distress' | 'gone_quiet' | 'upcoming_event'
  // case-aware distress (backend.md §5e)
  | 'hearing_soon' | 'bail_no_notice' | 'entitlement_unpaid' | 'adjournment_streak'
  // live monitoring (backend.md §6)
  | 'threat_reported' | 'case_issue' | 'repeated_distress' | 'outreach_escalated'
  // safety password used: someone may be forcing them to open the app
  | 'duress_login';

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
  // present when a hearing is within 14 days (backend.md §5a)
  forecast?: Forecast | null;
  // relief entitlements with amounts (counsellor only, backend.md §5b)
  entitlements?: Entitlement[];
  gender?: Gender | null;
  latest_reading?: Reading | null;
  peak_24h?: { level: number | null; label: DistressLabel | null; count: number };
  latest_insight?: Insight | null;
  profile?: OnboardingAnswers | null;
}

export interface Timeline {
  scores: { at: string; score: number; tier: Tier; crisis: boolean }[];
  // Chart extras (backend.md §3): questionnaire markers + per-day signal means.
  questionnaires?: { at: string; instrument: string; total: number; severity: string }[];
  signals?: Record<string, { date: string; mean: number; count: number }[]>;
}

// --- Case-aware distress: the calendar is the stressor (backend.md §5) ---

// Counsellor-only forecast that rides on a victim detail / caseload row when a
// hearing is within 14 days. Turns the score from a thermometer into a forecast.
export interface Forecast {
  peak_score: number;
  peak_on: string;    // YYYY-MM-DD
  days_until?: number;
  driver: string;     // short human string, e.g. "Bail Hearing on 2026-09-18"
}

// GET /me/case — victim's own calendar. Gentle, pre-translated, NO numbers.
// The victim side deliberately gets a COARSER kind than the counsellor side: the
// backend collapses bail_hearing/parole/trial_end into `court_date` so the docket
// word never reaches the screen. Use it for the icon only — the wording is in
// `label`, which the backend has already translated.
export type VictimEventKind =
  | 'court_date'
  | 'date_changed'
  | 'case_step'
  | 'support'
  | 'counselling';

// Same collapse, for the /me/events fallback path, which still returns raw kinds.
export const victimKind = (kind: EventKind): VictimEventKind =>
  kind === 'hearing' || kind === 'bail_hearing' || kind === 'parole' || kind === 'trial_end'
    ? 'court_date'
    : kind === 'adjournment'
      ? 'date_changed'
      : kind === 'compensation'
        ? 'support'
        : kind === 'counselling'
          ? 'counselling'
          : 'case_step';

export interface CaseUpcoming {
  id: number;
  kind: VictimEventKind;
  date: string;
  days_until: number;
  label: string;     // already written in the victim's language, non-clinical
}
export type EntitlementStatus = 'due' | 'received' | 'not_received' | 'unknown';
export type EntitlementStage =
  | 'fir' | 'chargesheet' | 'conviction' | 'trial_end' | 'medical_report' | 'post_mortem' | 'tame' | 'other';

// Victim sees no amount; counsellor also gets amount + note (backend.md §5b).
export interface Entitlement {
  id: number;
  stage: EntitlementStage | string;
  label: string;
  due_on: string | null;
  status: EntitlementStatus;
  answered_at?: string | null;
  amount?: number | null;   // counsellor only
  note?: string | null;     // counsellor only
}
export interface CaseInfo {
  upcoming: CaseUpcoming[];
  entitlements: Entitlement[];
}

// GET /counsellor/relief-schedule — the SC/ST (PoA) Annexure-I table.
export interface ReliefEntry {
  section: string;
  offence: string;
  amount: number;
  stages: string[];
  stage_labels?: Record<string, string>;
}

// GET /counsellor/forecast — "who needs attention this week", by predicted peak.
export interface ForecastRow {
  victim_id: string;
  name: string;
  score: number | null;
  tier?: Tier | null;
  peak_score: number;
  peak_on: string;
  days_until?: number;
  driver: string;
}

// --- Live monitoring (backend.md §6) ---

export type DistressLabel = 'none' | 'low' | 'moderate' | 'high';
export type ReadingChannel = 'chat' | 'voice_call' | 'voice_checkin' | 'voice_note' | 'message' | 'ivrs';

/** One message's distress reading. Never the words. */
export interface Reading {
  id: number;
  victim_id: string;
  victim_name?: string;
  at: string;
  channel: ReadingChannel;
  score: number;
  level: 0 | 1 | 2 | 3;
  label: DistressLabel;
  crisis: boolean;
  issues: string[];
}

/** What the assistant tells the counsellor about a conversation. */
export interface Insight {
  id: number;
  at: string;
  channel: string;
  period_start: string;
  period_end: string;
  turns: number;
  peak_level: 'calm' | 'low' | 'moderate' | 'high' | null;
  mean_score: number | null;
  generator: 'model' | 'rules';
  emotions: string[];
  summary: string;
  concerns: string[];
  case_problems: { category: string; description: string }[];
  risk_notes: string;
  follow_up: string;
}

export type IssueStatus = 'open' | 'in_progress' | 'action_taken' | 'resolved' | 'dismissed';

export interface LegalStep {
  id: string;
  text: string;
  basis?: string;
  source?: string;
}

export interface CaseIssue {
  id: number;
  category: string;
  severity: 'high' | 'medium';
  status: IssueStatus;
  source: 'detected' | 'insight' | 'victim_report' | 'counsellor';
  occurrences: number;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
  // counsellor view
  victim_id?: string;
  victim_name?: string;
  title?: string;
  summary?: string;
  evidence?: string | null;
  steps?: LegalStep[];
  actions?: { id: number; at: string; action: string; note: string | null; by: string | null }[];
  // victim view
  label?: string;
}

export interface LegalActions {
  about: string;
  checked: string;
  caveat: string;
  sources: Record<string, string>;
  categories: Record<string, { title: string; severity: 'high' | 'medium'; steps: LegalStep[] }>;
}

export interface ContactRequestView {
  id: number;
  kind: 'callback' | 'talk_soon' | 'ivrs_callback';
  preferred_time: 'asap' | 'morning' | 'afternoon' | 'evening' | null;
  status: 'open' | 'acknowledged' | 'done';
  at: string;
  handled_at: string | null;
  response: string | null;
  victim_id?: string;
  victim_name?: string;
  note?: string | null;
  handled_by?: string | null;
}

export interface CounsellorMessage {
  id: number;
  at: string;
  sender: 'victim' | 'counsellor';
  text: string;
  read_at: string | null;
}

export interface InboxRow {
  victim_id: string;
  victim_name: string;
  last_at: string;
  unread: number;
  last: { sender: 'victim' | 'counsellor'; text: string };
}

export interface Helpline {
  number: string;
  name: string;
  hours: string;
  what: string;
}

export interface SupportInfo {
  counsellor: { name: string | null; phone: string | null; hours: string | null } | null;
  unread_messages: number;
  requests: ContactRequestView[];
  helplines: Helpline[];
  /** Ring this number and hang up; SAAHAS calls back. null until a number is set up. */
  missed_call: { number: string; enabled: boolean } | null;
}

// GET /me/court-day - the day before, the day of and the evening after a court date.
export type CourtDayAction =
  | { kind: 'problem'; category: string; label: string }
  | { kind: 'breathe' | 'chat' | 'checkin'; label: string };

export interface CourtDay {
  event_id: number;
  phase: 'before' | 'day' | 'after';
  date: string;
  title: string;
  intro: string;
  tips: { id: string; text: string; basis?: string; source_url?: string; action?: CourtDayAction }[];
  actions: CourtDayAction[];
}

export interface CheckinCall {
  id: number;
  status: 'scheduled' | 'calling' | 'completed' | 'escalated' | 'cancelled';
  reason: string;
  missed_since: string;
  scheduled_for: string;
  deadline: string;
  attempts: number;
  reschedules: number;
  reschedules_left: number;
  updated_at: string;
  can_reschedule?: boolean;
  options?: { key: '1' | '2'; hours: number }[];
  victim_id?: string;
  victim_name?: string;
  outcome?: string | null;
}

export interface IvrsStep {
  say: string[];
  gather: number | null;
  hangup: boolean;
  language: string;
}

export interface Progress {
  days_active_7d: number;
  checkins_14d: number;
  conversations_7d: number;
}

export type Mood = 'calm' | 'okay' | 'tired' | 'anxious' | 'low' | 'reflective';

// ---------------------------------------------------------------- endpoints

const json = (method: string, body?: unknown, extra: Partial<RequestOptions> = {}): RequestOptions =>
  ({ method, body, ...extra });

export interface TeamMember {
  id: string;
  name: string;
  username: string | null;
  clients: number;
  since: string | null;
}

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
  // Add a username + password to a token-only account (backend.md §2).
  setCredentials: (username: string, password: string) =>
    apiFetch<{ username: string; has_password: boolean }>('/me/credentials',
      json('PUT', { username, password }, { keepSessionOn401: true })),
  sessions: () => apiFetch<SessionInfo[]>('/me/sessions'),
  revokeSession: (id: number) => apiFetch<{ revoked: boolean }>(`/me/sessions/${id}`, json('DELETE')),
  setDuressPassword: (currentPassword: string, duressPassword: string) =>
    apiFetch<{ has_duress: boolean }>('/me/duress-password',
      json('PUT', { current_password: currentPassword, duress_password: duressPassword }, { keepSessionOn401: true })),
  clearDuressPassword: (currentPassword: string) =>
    apiFetch<{ has_duress: boolean }>('/me/duress-password',
      json('DELETE', { current_password: currentPassword }, { keepSessionOn401: true })),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ changed: boolean; other_sessions_signed_out: number }>('/me/password',
      json('POST', { current_password: currentPassword, new_password: newPassword }, { keepSessionOn401: true })),

  // victim screens
  wellbeing: () => apiFetch<Wellbeing>('/me/wellbeing'),
  events: () => apiFetch<CaseEvent[]>('/me/events'),
  case: () => apiFetch<CaseInfo>('/me/case'),
  courtDay: () => apiFetch<CourtDay | null>('/me/court-day'),
  // Victim answers "did the support money arrive?" — no amounts (backend.md §5b).
  answerEntitlement: (id: number, status: EntitlementStatus) =>
    apiFetch<Entitlement>(`/me/entitlements/${id}`, json('POST', { status })),
  due: () => apiFetch<DueCheckin[]>('/me/due'),
  questionnaire: (instrument: string, lang: LanguageCode) =>
    apiFetch<Questionnaire>(`/questionnaires/${encodeURIComponent(instrument)}?lang=${lang}`, { auth: false }),
  submitQuestionnaire: (instrument: string, answers: number[]) =>
    apiFetch<SubmitResult>(`/me/questionnaires/${encodeURIComponent(instrument)}`, json('POST', { answers })),
  // What was said before, so the chat and the voice call carry on as one
  // conversation. Empty unless the person consented to keeping messages.
  conversation: (limit?: number) =>
    apiFetch<{ turns: ConversationTurn[]; stored: boolean }>(
      `/me/conversation${limit ? `?limit=${limit}` : ''}`),
  forgetConversation: () => apiFetch<{ deleted: number }>('/me/conversation', json('DELETE')),
  recordings: () => apiFetch<Recording[]>('/me/recordings'),
  deleteRecording: (id: string) => apiFetch<{ deleted: boolean }>(`/me/recordings/${id}`, json('DELETE')),
  updateSettings: (body: { gender?: Gender; ui_style?: UiStyle; phone?: string; clear_phone?: boolean }) =>
    apiFetch<Me>('/me/settings', json('PATCH', body)),
  mood: (mood: Mood) => apiFetch<{ saved: boolean }>('/me/mood', json('POST', { mood })),
  progress: () => apiFetch<Progress>('/me/progress'),
  support: () => apiFetch<SupportInfo>('/me/support'),
  requestContact: (body: { kind?: 'callback' | 'talk_soon'; preferred_time: ContactRequestView['preferred_time']; note?: string | null }) =>
    apiFetch<ContactRequestView>('/me/contact-requests', json('POST', body)),
  messages: () => apiFetch<CounsellorMessage[]>('/me/messages'),
  sendMessage: (text: string) =>
    apiFetch<{ message: CounsellorMessage; crisis: boolean; crisis_message: string | null; safety: boolean }>(
      '/me/messages', json('POST', { text })),
  issueCategories: () => apiFetch<{ category: string; label: string; severity: string }[]>('/me/issues/categories'),
  myIssues: () => apiFetch<CaseIssue[]>('/me/issues'),
  reportIssue: (category: string, note: string | null) =>
    apiFetch<CaseIssue>('/me/issues', json('POST', { category, note })),
  checkinCall: () => apiFetch<{ call: CheckinCall | null; enabled: boolean; max_reschedules: number }>('/me/checkin-call'),
  rescheduleCheckinCall: (option: '1' | '2') =>
    apiFetch<{ call: CheckinCall }>('/me/checkin-call/reschedule', json('POST', { option })),

  // counsellor dashboard
  caseload: () => apiFetch<CaseloadRow[]>('/counsellor/victims'),
  forecast: () => apiFetch<ForecastRow[]>('/counsellor/forecast'),
  victim: (id: string) => apiFetch<VictimDetail>(`/counsellor/victims/${id}`),
  timeline: (id: string, days = 30) => apiFetch<Timeline>(`/counsellor/victims/${id}/timeline?days=${days}`),
  alerts: (status: 'open' | 'acknowledged' | 'resolved' | 'all' = 'open') =>
    apiFetch<Alert[]>(`/counsellor/alerts?status=${status}`),
  acknowledgeAlert: (id: number) => apiFetch<Alert>(`/counsellor/alerts/${id}/acknowledge`, json('POST')),
  resolveAlert: (id: number, note?: string) =>
    apiFetch<Alert>(`/counsellor/alerts/${id}/resolve`, json('POST', { note: note ?? null })),
  addEvent: (
    victimId: string,
    // notice_given carries s.15A: notice to the victim before a bail or parole
    // hearing is mandatory, and omitting it is what raises `bail_no_notice`.
    event: { kind: EventKind; date: string; title: string; notice_given?: boolean },
  ) =>
    apiFetch<CaseEvent>(`/counsellor/victims/${victimId}/events`, json('POST', event)),
  deleteEvent: (eventId: number) => apiFetch<{ deleted: boolean }>(`/counsellor/events/${eventId}`, json('DELETE')),
  victimRecordings: (victimId: string) => apiFetch<Recording[]>(`/counsellor/victims/${victimId}/recordings`),

  // Relief entitlements (backend.md §5b)
  victimEntitlements: (victimId: string) =>
    apiFetch<Entitlement[]>(`/counsellor/victims/${victimId}/entitlements`),
  addEntitlement: (
    victimId: string,
    body: { stage: EntitlementStage; amount?: number | null; due_on?: string | null; note?: string | null },
  ) => apiFetch<Entitlement>(`/counsellor/victims/${victimId}/entitlements`, json('POST', body)),
  updateEntitlement: (
    id: number,
    body: { status?: EntitlementStatus; amount?: number | null; due_on?: string | null; note?: string | null },
  ) => apiFetch<Entitlement>(`/counsellor/entitlements/${id}`, json('PATCH', body)),
  reliefSchedule: () => apiFetch<{ entries: ReliefEntry[] }>('/counsellor/relief-schedule'),
  addReliefFromSchedule: (victimId: string, section: string) =>
    apiFetch<{ section: string; offence: string; total: number; entitlements: Entitlement[] }>(
      `/counsellor/victims/${victimId}/relief`, json('POST', { section })),

  // Live monitoring (backend.md §6)
  feed: (limit = 100) => apiFetch<Reading[]>(`/counsellor/feed?limit=${limit}`),
  victimReadings: (victimId: string, limit = 100) =>
    apiFetch<Reading[]>(`/counsellor/victims/${victimId}/readings?limit=${limit}`),
  victimInsights: (victimId: string) => apiFetch<Insight[]>(`/counsellor/victims/${victimId}/insights`),
  summariseNow: (victimId: string) =>
    apiFetch<{ summarised: boolean }>(`/counsellor/victims/${victimId}/insights/flush`, json('POST')),
  legalActions: () => apiFetch<LegalActions>('/counsellor/legal-actions'),
  issues: (status: 'active' | 'all' | IssueStatus = 'active', victimId?: string) =>
    apiFetch<CaseIssue[]>(`/counsellor/issues?status=${status}${victimId ? `&victim_id=${victimId}` : ''}`),
  logIssue: (victimId: string, category: string, note: string | null) =>
    apiFetch<CaseIssue>(`/counsellor/victims/${victimId}/issues`, json('POST', { category, note })),
  updateIssue: (id: number, body: { status?: IssueStatus; action?: string; note?: string | null }) =>
    apiFetch<CaseIssue>(`/counsellor/issues/${id}`, json('PATCH', body)),
  contactRequests: (status: 'open' | 'acknowledged' | 'done' | 'all' = 'open') =>
    apiFetch<ContactRequestView[]>(`/counsellor/contact-requests?status=${status}`),
  handleContactRequest: (id: number, status: 'acknowledged' | 'done', response?: string | null) =>
    apiFetch<ContactRequestView>(`/counsellor/contact-requests/${id}`, json('POST', { status, response: response ?? null })),
  inbox: () => apiFetch<InboxRow[]>('/counsellor/messages'),
  thread: (victimId: string) => apiFetch<CounsellorMessage[]>(`/counsellor/victims/${victimId}/messages`),
  reply: (victimId: string, text: string) =>
    apiFetch<CounsellorMessage>(`/counsellor/victims/${victimId}/messages`, json('POST', { text })),
  outreach: (status: 'active' | 'all' = 'active') => apiFetch<CheckinCall[]>(`/counsellor/outreach?status=${status}`),
  simulateCall: (callId: number, event: string, digits?: string) =>
    apiFetch<IvrsStep>('/ivrs/simulate', json('POST', { call_id: callId, event, digits: digits ?? null })),
  team: () => apiFetch<TeamMember[]>('/counsellor/team'),
  addCounsellor: (name: string, username: string, password: string) =>
    apiFetch<{ id: string; name: string; username: string; adopted: number }>('/counsellor/team', json('POST', { name, username, password })),
  myContactCard: () => apiFetch<{ name: string; phone: string | null; hours: string | null }>('/counsellor/me/contact'),
  setMyContactCard: (phone: string | null, hours: string | null) =>
    apiFetch<{ name: string; phone: string | null; hours: string | null }>('/counsellor/me/contact', json('PUT', { phone, hours })),
};
