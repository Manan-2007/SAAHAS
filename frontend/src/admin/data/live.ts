// The counsellor's real caseload for the Command Centre, shaped into the
// CaseData the dashboard views render. Sources: GET /counsellor/victims,
// /counsellor/victims/{id}, /counsellor/victims/{id}/timeline and
// /counsellor/alerts (backend/backend.md section 3).
//
// Anything the backend doesn't measure is shown as "—" rather than invented.

import { Alert, AlertReason, CaseEvent, CaseloadRow, EventKind, Tier, Timeline, VictimDetail, api } from '../../lib/api';
import { CaseData, InterventionItem, MultimodalSignal, NotificationItem } from '../types';

export const REASON_TITLES: Record<AlertReason, string> = {
  crisis_signal: 'Crisis Signal',
  high_distress: 'High Distress',
  rising_distress: 'Rising Distress',
  gone_quiet: 'Silent Deterioration Detected',
  upcoming_event: 'Court Stress Alert',
  hearing_soon: 'Hearing Soon',
  bail_no_notice: 'Bail Hearing · No s.15A Notice',
  entitlement_unpaid: 'Relief Overdue',
  adjournment_streak: 'Repeated Adjournments',
};

// Material Symbols per reason. bail_no_notice gets a distinct legal icon — it is
// a legal failure (s.15A notice not recorded), not a mood reading (backend.md §5d).
export const REASON_ICONS: Record<AlertReason, string> = {
  crisis_signal: 'e911_emergency',
  high_distress: 'warning',
  rising_distress: 'trending_up',
  gone_quiet: 'volume_off',
  upcoming_event: 'gavel',
  hearing_soon: 'gavel',
  bail_no_notice: 'balance',
  entitlement_unpaid: 'payments',
  adjournment_streak: 'event_repeat',
};

const LEVEL_RANK: Record<Alert['level'], number> = { crisis: 0, high: 1, watch: 2 };

const EVENT_LABELS: Record<EventKind, string> = {
  hearing: 'Hearing',
  fir: 'FIR',
  chargesheet: 'Chargesheet',
  compensation: 'Compensation',
  counselling: 'Counselling',
  other: 'Case date',
  bail_hearing: 'Bail hearing',
  parole: 'Parole hearing',
  adjournment: 'Adjournment',
  trial_end: 'Trial verdict',
};

const TIER_LABELS: Record<Tier, string> = {
  stable: 'Stable',
  watch: 'Watch',
  elevated: 'Elevated',
  high: 'High',
};

const DAY_MS = 86_400_000;
const NONE = '—';

export function timeAgo(iso: string | null): string {
  if (!iso) return 'No contact yet';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase();

const points = (n: number | null | undefined) =>
  n == null ? NONE : Math.round(n) === 0 ? '±0 pts' : `${n > 0 ? '↑' : '↓'} ${Math.abs(Math.round(n))} pts`;

const rounded = (n: number | null | undefined) => (n == null ? NONE : Math.round(n));

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function trendText(row: CaseloadRow): string {
  const { direction, change_7d } = row.trend;
  if (direction === 'rising') return `${points(change_7d)} this week`;
  if (direction === 'falling') return `${points(change_7d)} this week`;
  if (direction === 'steady') return 'Steady this week';
  return 'Not enough data yet';
}

function eventText(e: CaseEvent): string {
  return e.days_until === 0 ? `${EVENT_LABELS[e.kind]} today` : `${EVENT_LABELS[e.kind]} in ${e.days_until}d`;
}

// Component values are 0-100 where higher means more distress (engagement: more withdrawn)
function signal(type: MultimodalSignal['type'], label: string, value: number | undefined, source: string): MultimodalSignal {
  if (value == null) {
    return { type, label, description: `No ${source} in the last few weeks`, status: 'No data', statusColor: 'secondary' };
  }
  const high = value >= 60;
  const changed = value >= 35;
  return {
    type,
    label,
    description: `${Math.round(value)}/100 from ${source}`,
    status: type === 'engagement' ? (high ? 'Reduced' : 'Stable') : high ? 'High Stress' : changed ? 'Changed' : 'Stable',
    statusColor: high ? 'error' : changed ? 'amber' : 'primary',
  };
}

function legalSignal(next: CaseEvent | null): MultimodalSignal {
  if (!next) {
    return { type: 'legal', label: 'Legal / Case Context', description: 'No case dates in the next 30 days', status: 'Stable', statusColor: 'secondary' };
  }
  return {
    type: 'legal',
    label: 'Legal / Case Context',
    description: `${next.title} on ${shortDate(next.date)}`,
    status: next.days_until <= 3 ? 'High Stress' : next.days_until <= 14 ? 'Changed' : 'Stable',
    statusColor: next.days_until <= 3 ? 'error' : next.days_until <= 14 ? 'amber' : 'secondary',
  };
}

function statusOf(row: CaseloadRow, top: Alert | undefined): Pick<CaseData, 'status' | 'statusType'> {
  if (top) return { status: REASON_TITLES[top.reason] ?? 'Follow-up Required', statusType: top.level === 'watch' ? 'amber' : 'error' };
  if (row.crisis) return { status: 'Crisis Signal', statusType: 'error' };
  if (row.tier === 'high' || row.tier === 'elevated') return { status: 'Follow-up Required', statusType: 'amber' };
  if (row.tier === 'watch') return { status: 'Watch', statusType: 'info' };
  if (row.tier === 'stable') return { status: 'Stabilizing • Recovery Tracking', statusType: 'success' };
  return { status: 'Awaiting first check-in', statusType: 'info' };
}

function escalationRisk(row: CaseloadRow): CaseData['escalationRisk'] {
  if (row.crisis || row.tier === 'high') return 'HIGH';
  if (row.tier === 'elevated') return 'MODERATE';
  if (row.tier === 'watch') return 'LOW';
  return 'STABLE';
}

// Detect -> Intervene -> Follow-up -> Measure -> Recover
function recoveryStep(row: CaseloadRow, alerts: Alert[]): number {
  if (alerts.some((a) => a.status === 'open')) return 1;
  if (alerts.some((a) => a.status === 'acknowledged')) return 3;
  if (row.tier === 'stable' && row.trend.direction !== 'rising') return 5;
  return row.score == null ? 1 : 4;
}

function interventions(alerts: Alert[], events: CaseEvent[], counsellor: string): InterventionItem[] {
  const fromAlerts: InterventionItem[] = alerts
    .filter((a) => a.status !== 'resolved')
    .map((a) => ({
      id: `alert-${a.id}`,
      title: `${REASON_TITLES[a.reason] ?? 'Alert'}: follow up`,
      subtitle: a.message,
      assignedTo: counsellor,
      priority: `${a.level.charAt(0).toUpperCase()}${a.level.slice(1)} priority`,
      status: a.status === 'acknowledged' ? 'In Progress' : 'Pending',
      completed: false,
    }));
  const fromEvents: InterventionItem[] = events
    .filter((e) => e.days_until >= 0 && e.days_until <= 30)
    .map((e) => ({
      id: `event-${e.id}`,
      title: e.title,
      subtitle: `${EVENT_LABELS[e.kind]} · ${shortDate(e.date)}`,
      assignedTo: counsellor,
      priority: e.days_until <= 3 ? 'Soon' : 'Upcoming',
      status: 'Scheduled',
      completed: false,
    }));
  const items = [...fromAlerts, ...fromEvents];
  return items.length
    ? items
    : [{ id: 'routine', title: 'Routine check-in call', subtitle: 'No open alerts', assignedTo: counsellor,
         priority: 'Routine', status: 'Optional', completed: false }];
}

function toCase(row: CaseloadRow, detail: VictimDetail, timeline: Timeline, counsellor: string, cohort: string): CaseData {
  const alerts = [...detail.alerts].sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
  const top = alerts.find((a) => a.status === 'open');
  const components = detail.latest?.components ?? {};
  const next = row.next_event;
  const soon = next && next.days_until <= 30 ? next : null;
  const first = timeline.scores[0];
  const confidence = Math.round((detail.latest?.confidence ?? 0) * 100);
  const daysSinceContact = row.last_contact_at
    ? Math.floor((Date.now() - new Date(row.last_contact_at).getTime()) / DAY_MS)
    : NONE;

  return {
    id: row.user_id,
    number: row.case_ref || `#${row.user_id.slice(0, 6).toUpperCase()}`,
    name: row.name,
    initials: initials(row.name),
    registeredDate: new Date(detail.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
    assignedCounsellor: counsellor,
    ...statusOf(row, top),
    timeAgo: timeAgo(row.last_contact_at),
    keyHighlight: soon ? eventText(soon) : row.open_alerts ? `${row.open_alerts} open alert${row.open_alerts > 1 ? 's' : ''}` : trendText(row),
    keyHighlightIcon: soon ? (soon.kind === 'hearing' ? 'gavel' : 'event') : row.open_alerts ? 'notifications' : 'monitoring',
    keyHighlightColor: soon && soon.days_until <= 3 ? 'error' : row.open_alerts ? 'amber' : 'secondary',
    subHighlight: row.score == null ? 'No score yet' : `Score ${Math.round(row.score)}/100 · ${trendText(row)}`,

    wellbeingIndex: rounded(row.score),
    wellbeingDelta: points(row.trend.change_7d),
    fatigueMarker: rounded(components.voice),
    fatigueDelta: '',
    escalationRisk: escalationRisk(row),
    escalationReason: top ? REASON_TITLES[top.reason] : soon && soon.days_until <= 7 ? eventText(soon) : trendText(row),

    alertTitle: top ? REASON_TITLES[top.reason] : 'No open alerts',
    alertConfCode: top ? `${top.level.toUpperCase()} · ${timeAgo(top.at)}` : '',
    alertDescription: top
      ? top.message
      : 'Nothing needs action right now. The score is recomputed hourly and after every check-in.',
    metrics: {
      responseLengthDelta: String(rounded(components.questionnaires)),
      responseLengthNote: 'questionnaires, 0-100',
      responseLatencyDelta: String(rounded(components.text)),
      responseLatencyNote: 'chat distress, 0-100',
      voiceDurationDelta: String(rounded(components.voice)),
      voiceDurationNote: 'voice distress, 0-100',
      missedCheckins: daysSinceContact,
      missedCheckinsNote: 'days since last contact',
    },

    signals: [
      signal('text', 'Chat Messages', components.text, 'chat messages'),
      signal('voice', 'Voice Check-ins', components.voice, 'voice check-ins'),
      signal('engagement', 'App Engagement', components.engagement, 'engagement'),
      legalSignal(next),
    ],

    aiConfidencePct: confidence,
    aiConfidenceLabel: `${confidence}% of signals`,
    aiConfidenceDescription:
      'Share of the score’s signals (questionnaires, chat, voice, engagement) with recent data. Review before acting on a low-coverage score.',
    explainableRuleId: 'Distress Score v1 · fixed weights',

    whyRecommended: top?.message ?? (soon ? `${soon.title} on ${shortDate(soon.date)}` : 'Routine follow-up'),
    interventions: interventions(alerts, detail.events, counsellor),

    cohortImprovementPct: cohort,
    distressBefore: first ? Math.round(first.score) : NONE,
    distressBeforeLabel: first ? TIER_LABELS[first.tier] : 'No score yet',
    distressAfter: rounded(row.score),
    distressAfterLabel: row.tier ? TIER_LABELS[row.tier] : 'No score yet',
    distressDelta: first && row.score != null ? `(${points(row.score - first.score)})` : '',
    trendPoints: timeline.scores.map((s) => s.score),
    forecast: detail.forecast ?? null,
    currentStep: recoveryStep(row, alerts),
  };
}

function toNotification(a: Alert): NotificationItem {
  return {
    id: `alert-${a.id}`,
    caseId: a.user_id,
    caseName: a.victim_name,
    title: REASON_TITLES[a.reason] ?? 'Alert',
    description: a.message,
    time: timeAgo(a.at),
    severity: a.level === 'watch' ? 'medium' : 'high',
    unread: true,
  };
}

export interface LiveCaseload {
  cases: CaseData[];
  notifications: NotificationItem[];
}

export async function loadCaseload(counsellor: string): Promise<LiveCaseload> {
  const [rows, openAlerts] = await Promise.all([api.caseload(), api.alerts('open')]);
  const improving = rows.filter((r) => r.trend.direction === 'falling').length;
  const cohort = rows.length ? `${Math.round((improving / rows.length) * 100)}% improving` : NONE;
  const cases = await Promise.all(
    rows.map(async (row) => {
      const [detail, timeline] = await Promise.all([api.victim(row.user_id), api.timeline(row.user_id, 30)]);
      return toCase(row, detail, timeline, counsellor, cohort);
    }),
  );
  return { cases, notifications: openAlerts.map(toNotification) };
}
