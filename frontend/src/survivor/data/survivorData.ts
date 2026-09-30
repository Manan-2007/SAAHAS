// The survivor app's data adapter: every backend read and write the screens
// need, and the words that turn backend values into gentle language.
//
// Screens import from here, never from lib/api directly, so the product
// rules live in one place:
//   - no scores, tiers, severities or amounts ever reach a survivor screen
//     (the victim endpoints don't send them; nothing here derives them)
//   - no invented data: when the backend has nothing, screens get nothing
//     and show an empty state (CLAUDE.md: "no demo data")

import {
  ApiError,
  CaseInfo,
  CaseIssue,
  Consent,
  Gender,
  UiStyle,
  fetchAudioUrl,
  CaseUpcoming,
  CheckinCall,
  ContactRequestView,
  CounsellorMessage,
  DueCheckin,
  EntitlementStatus,
  Helpline,
  Mood,
  Progress,
  SupportInfo,
  Trend,
  VictimEventKind,
  Wellbeing,
  api,
  victimKind,
  CourtDay,
} from '../../lib/api';
import type { LanguageCode } from '../../types';
import type { StringKey } from '../../i18n/strings';
import { useRemote } from './useRemote';

// ---------------------------------------------------------------- reads

/** What's coming up and what support money to ask about. Falls back to /me/events. */
export function useCaseInfo(enabled: boolean) {
  return useRemote<CaseInfo>(
    async () => {
      try {
        return await api.case();
      } catch (err) {
        const events = await api.events().catch(() => {
          throw err;
        });
        return {
          upcoming: events.map((e) => ({
            id: e.id,
            kind: victimKind(e.kind),
            date: e.date,
            days_until: e.days_until,
            label: e.title,
          })),
          entitlements: [],
        };
      }
    },
    [],
    enabled,
  );
}

export const useSupportInfo = (enabled: boolean) => useRemote<SupportInfo>(() => api.support(), [], enabled);
export const useWellbeing = (enabled: boolean) => useRemote<Wellbeing>(() => api.wellbeing(), [], enabled);
export const useDue = (enabled: boolean) => useRemote<DueCheckin[]>(() => api.due(), [], enabled);
export const useProgress = (enabled: boolean) => useRemote<Progress>(() => api.progress(), [], enabled);
/** The day before, the day of and the evening after a court date (null otherwise). */
export const useCourtDay = (enabled: boolean) => useRemote<CourtDay | null>(() => api.courtDay(), [], enabled);

/** A missed check-in call that's scheduled or ringing (IVRS, backend.md 6e). */
export const useCheckinCall = (enabled: boolean) =>
  useRemote<CheckinCall | null>(async () => {
    const { call } = await api.checkinCall();
    return call && (call.status === 'scheduled' || call.status === 'calling') ? call : null;
  }, [], enabled);

export const rescheduleCall = async (option: '1' | '2') => (await api.rescheduleCheckinCall(option)).call;

/** The secure thread with the counsellor - a real person reads it. */
export const useMessages = (enabled: boolean) => useRemote<CounsellorMessage[]>(() => api.messages(), [], enabled);
export const sendCounsellorMessage = (text: string) => api.sendMessage(text);
export const requestCallback = (preferred: ContactRequestView['preferred_time'], note: string | null) =>
  api.requestContact({ kind: 'callback', preferred_time: preferred, note });

// Case problems (backend.md 6c): the survivor picks a plain-words category;
// the counsellor gets it with the legal steps attached.
export const useIssueCategories = (enabled: boolean) => useRemote(() => api.issueCategories(), [], enabled);
export const useMyIssues = (enabled: boolean) => useRemote<CaseIssue[]>(() => api.myIssues(), [], enabled);
export const reportIssue = (category: string, note: string | null) => api.reportIssue(category, note);
/** Categories that also mean "you may not be safe": show protection, not just a thank-you. */
export const SAFETY_CATEGORIES = new Set(['threat', 'pressure_to_compromise', 'boycott_harassment']);

/** Dates from today on, soonest first. */
export const upcomingFrom = (info: CaseInfo | undefined): CaseUpcoming[] =>
  (info?.upcoming ?? []).filter((e) => e.days_until >= 0).sort((a, b) => a.days_until - b.days_until);

/** Home asks only what nobody has answered yet; asking again every visit is its own pressure. */
export const unansweredEntitlements = (info: CaseInfo | undefined) =>
  (info?.entitlements ?? []).filter((e) => e.status === 'due');

/** Prepare lists everything not yet received, so a later "it arrived" can still be told. */
export const pendingEntitlements = (info: CaseInfo | undefined) =>
  (info?.entitlements ?? []).filter((e) => e.status !== 'received');

/** The questionnaire the backend says is due: full ones before the short pulse. */
export function dueInstrument(due: DueCheckin[] | undefined): string | null {
  const open = (due ?? []).filter((d) => d.due);
  return (open.find((d) => d.instrument !== 'phq4') ?? open[0])?.instrument ?? null;
}

// ---------------------------------------------------------------- helplines

// Real, free Indian lines (the same set the backend's /me/support returns).
// Used when that call hasn't answered: guests, or the backend being down,
// must still see every number.
export const FALLBACK_HELPLINES: Helpline[] = [
  { number: '112', name: 'Emergency', hours: '24x7', what: 'Police, fire or ambulance if you are in danger now' },
  { number: '14566', name: 'National Helpline Against Atrocities', hours: '24x7, toll-free', what: 'Report an atrocity or a problem with your SC/ST case' },
  { number: '181', name: 'Women Helpline', hours: '24x7', what: 'Support for women facing violence' },
  { number: '14416', name: 'Tele-MANAS', hours: '24x7, free, many languages', what: 'Someone to talk to about how you feel' },
  { number: '15100', name: 'NALSA Legal Aid', hours: 'Free legal help', what: 'Free lawyers and legal advice' },
];

/** The three lines a crisis banner always shows first (CLAUDE.md: never weakened). */
export const CRISIS_LINES: { number: string; key: StringKey }[] = [
  { number: '112', key: 'crisis.112' },
  { number: '181', key: 'crisis.181' },
  { number: '14416', key: 'crisis.14416' },
];

export const telHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, '')}`;

// ---------------------------------------------------------------- writes

export const answerEntitlement = (id: number, status: EntitlementStatus) => api.answerEntitlement(id, status);

// Screening questionnaires: the backend decides what's due and never returns
// a score or severity to this side - only { saved, crisis, wellbeing }.
export const loadQuestionnaire = (instrument: string, language: LanguageCode) => api.questionnaire(instrument, language);
export const submitQuestionnaire = (instrument: string, answers: number[]) => api.submitQuestionnaire(instrument, answers);

// The check-in offers seven words. The backend's /me/mood accepts six moods
// (monitoring/service.py, MOODS), so each word is sent as its nearest one and
// the counsellor's feed stays truthful. Adding these words to MOODS on the
// backend would let them through as they are.
export type Feeling = 'okay' | 'tired' | 'restless' | 'heavy' | 'hopeful' | 'disconnected' | 'unsure';
export const FEELINGS: Feeling[] = ['okay', 'tired', 'restless', 'heavy', 'hopeful', 'disconnected', 'unsure'];
const FEELING_TO_MOOD: Record<Feeling, Mood> = {
  okay: 'okay',
  tired: 'tired',
  restless: 'anxious',
  heavy: 'low',
  hopeful: 'calm',
  disconnected: 'low',
  unsure: 'reflective',
};
export const recordFeeling = (feeling: Feeling) => api.mood(FEELING_TO_MOOD[feeling]);
export const feelingKey = (feeling: Feeling) => `mood.${feeling}` as StringKey;
export const replyKey = (feeling: Feeling) => `checkin.reply.${feeling}` as StringKey;

/**
 * Saves a new language to the account. PUT /me/profile replaces the whole
 * onboarding profile, so the existing answers are sent back with it.
 */
export async function saveLanguage(language: LanguageCode): Promise<void> {
  const me = await api.me();
  const p = me.profile;
  await api.saveProfile({
    display_name: me.name,
    language,
    coping: p?.coping ?? null,
    low_time: p?.low_time ?? null,
    channel: p?.channel ?? null,
    baseline_mood: p?.baseline_mood ?? null,
    comfort: p?.comfort ?? null,
  });
}

/** Everything the Privacy screen can read or change about the account. */
export const account = {
  sessions: () => api.sessions(),
  revokeSession: (id: number) => api.revokeSession(id),
  recordings: () => api.recordings(),
  deleteRecording: (id: string) => api.deleteRecording(id),
  playRecording: (id: string) => fetchAudioUrl(`/me/recordings/${id}/audio`),
  updateConsent: (changes: Partial<Omit<Consent, 'data_storage'>>) => api.updateConsent(changes),
  updateSettings: (body: { gender?: Gender; ui_style?: UiStyle; phone?: string; clear_phone?: boolean }) => api.updateSettings(body),
  setCredentials: (username: string, password: string) => api.setCredentials(username, password),
  changePassword: (current: string, next: string) => api.changePassword(current, next),
  setDuress: (current: string, duress: string) => api.setDuressPassword(current, duress),
  clearDuress: (current: string) => api.clearDuressPassword(current),
  forgetConversation: () => api.forgetConversation(),
  deleteEverything: () => api.deleteMe(),
};

/**
 * Words for a failed request. The backend's own message is shown only for
 * requests it refused on purpose (a taken username, a missing field) - never a
 * raw "Method Not Allowed" or a stack of server detail.
 */
export const errorText = (err: unknown) =>
  err instanceof ApiError && [400, 409, 422, 429].includes(err.status)
    ? err.message
    : 'That didn’t go through just now. Please try again in a moment.';

// ---------------------------------------------------------------- gentle words

/** "good evening" and friends, by the clock on this phone. */
export function greetingKey(date = new Date()): StringKey {
  const h = date.getHours();
  if (h < 5) return 'home.late';
  if (h < 12) return 'home.morning';
  if (h < 17) return 'home.afternoon';
  if (h < 22) return 'home.evening';
  return 'home.late';
}

// Trend words from /me/wellbeing, said the way a friend would. Never a number,
// never a band, and the same colour whatever they say.
export const LATELY: Record<'energy' | 'fatigue' | 'stress', Record<Trend, string>> = {
  energy: {
    Improving: 'your energy has felt a little steadier.',
    Stable: 'your energy has been about the same.',
    Elevated: 'there’s been a lot of energy moving through you.',
    'Rest needed': 'your body seems to be asking for more rest.',
  },
  fatigue: {
    Improving: 'tiredness seems to be easing.',
    Stable: 'rest and sleep seem about the same.',
    Elevated: 'you may be more tired than usual.',
    'Rest needed': 'sleep may have been harder lately.',
  },
  stress: {
    Improving: 'things seem to have eased a little.',
    Stable: 'things have felt about as they usually do.',
    Elevated: 'things may have felt a little heavier.',
    'Rest needed': 'it might be a time to go slowly.',
  },
};

/** A trend that deserves "that's okay." after it. */
export const isHeavy = (t: Trend) => t === 'Elevated' || t === 'Rest needed';

// The survivor side only ever gets these coarse kinds, never "bail" or "parole".
export const EVENT_NOTE: Record<VictimEventKind, string> = {
  court_date: 'Your counsellor can help you prepare.',
  date_changed: 'The date has moved.',
  case_step: 'A step in your case.',
  support: 'About support you’re owed.',
  counselling: 'A chance to talk things through.',
};

const eventDate = (e: { date: string }) => new Date(`${e.date}T00:00:00`);

export function dayLabel(e: { date: string }, language: LanguageCode): string {
  const locale = language === 'en' ? 'en-IN' : language === 'hi' ? 'hi-IN' : 'pa-IN';
  return eventDate(e).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function monthDay(e: { date: string }, language: LanguageCode) {
  const locale = language === 'en' ? 'en-IN' : language === 'hi' ? 'hi-IN' : 'pa-IN';
  const d = eventDate(e);
  return { month: d.toLocaleDateString(locale, { month: 'short' }), day: d.getDate() };
}

export function relativeKey(daysUntil: number): { key: StringKey; n?: number } {
  if (daysUntil <= 0) return { key: 'upcoming.today' };
  if (daysUntil === 1) return { key: 'upcoming.tomorrow' };
  return { key: 'upcoming.inDays', n: daysUntil };
}

export const initials = (name: string) =>
  name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
