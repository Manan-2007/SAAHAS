import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CaseData, NavigationTab, NotificationItem } from './types';
import { REASON_TITLES, loadCaseload, loadOneCase, timeAgo } from './data/live';
import { ApiError, api } from '../lib/api';
import { LiveEvent, openLiveStream } from '../lib/liveStream';
import { emitLive } from './liveBus';
import { LiveFeedView } from './components/LiveFeedView';
import { CaseIssuesView } from './components/CaseIssuesView';
import { InboxView } from './components/InboxView';
import { OutreachView } from './components/OutreachView';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './components/OverviewView';
import { PriorityCasesView } from './components/PriorityCasesView';
import { CaseDetailView } from './components/CaseDetailView';
import { InterventionsView } from './components/InterventionsView';
import { RecoveryOutcomesView } from './components/RecoveryOutcomesView';
import { ForecastView } from './components/ForecastView';
import { HowScoringView } from './components/HowScoringView';
import { SystemSettingsView } from './components/SystemSettingsView';
import {
  QuickLockModal,
  NotificationDrawer,
  ScheduleFollowUpModal,
  AuditTrailModal,
} from './components/Modals';

interface AdminAppProps {
  counsellorName: string;
  onSignOut: () => void;
}

// Live updates arrive over the stream; this slower poll is only a safety net
// for anything that happens while the connection is down.
const REFRESH_MS = 120_000;

const TOAST_FOR: Record<string, (e: LiveEvent, name: string) => string | null> = {
  alert: (e, n) => (e.level === 'crisis' ? `Crisis signal: ${n}` : `New alert for ${n}`),
  issue: (e, n) => (e.created ? `${n}: ${String(e.category ?? 'case problem').replace(/_/g, ' ')}${e.reported ? ' (reported by them)' : ''}` : null),
  message: (e, n) => (e.own ? null : `New message from ${n}`),
  contact_request: (e, n) => (e.handled ? null : `${n} asked for a call back`),
  insight: (_e, n) => `New conversation summary for ${n}`,
  outreach: (e, n) => (e.status === 'escalated' ? `${n} missed a check-in and can't be reached` : null),
};

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : "Can't reach the SAHAAS backend. Check that it's running.";

// "YYYY-MM-DD" whatever the date input gave us
const isoDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date(value).toISOString().slice(0, 10);

// Counsellor Command Centre — the trauma-informed monitoring dashboard,
// showing the signed-in counsellor's real caseload (data/live.ts).
export default function AdminApp({ counsellorName, onSignOut }: AdminAppProps) {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // View state flags
  const [isQuickLocked, setIsQuickLocked] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [feedUnseen, setFeedUnseen] = useState(0);
  const [escalatedCalls, setEscalatedCalls] = useState(0);
  const casesRef = useRef<CaseData[]>([]);
  casesRef.current = cases;
  const pending = useRef<Map<string, number>>(new Map());

  const refresh = useCallback(async () => {
    try {
      const data = await loadCaseload(counsellorName);
      setCases(data.cases);
      // Keep notifications already marked read as read
      setNotifications((prev) => {
        const read = new Set(prev.filter((n) => !n.unread).map((n) => n.id));
        return data.notifications.map((n) => (read.has(n.id) ? { ...n, unread: false } : n));
      });
      setSelectedCaseId((id) => (data.cases.some((c) => c.id === id) ? id : data.cases[0]?.id ?? ''));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [counsellorName]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const loadOutreachCount = useCallback(() => {
    api.outreach('active').then((calls) => setEscalatedCalls(calls.filter((c) => c.status === 'escalated').length)).catch(() => {});
  }, []);
  useEffect(loadOutreachCount, [loadOutreachCount]);

  // One client changed: refresh just that client, a moment later so a burst of
  // events (reading, score, alert, issue for one message) is one fetch.
  const refreshCase = useCallback((victimId: string) => {
    const timers = pending.current;
    window.clearTimeout(timers.get(victimId));
    timers.set(victimId, window.setTimeout(async () => {
      timers.delete(victimId);
      const cohort = casesRef.current[0]?.cohortImprovementPct ?? '—';
      try {
        const updated = await loadOneCase(counsellorName, victimId, cohort);
        if (!updated) return refresh();           // a new client: take the full list
        setCases((prev) => {
          const exists = prev.some((c) => c.id === victimId);
          return exists ? prev.map((c) => (c.id === victimId ? updated : c)) : [...prev, updated];
        });
        const alerts = await api.alerts('open');
        setNotifications((prev) => {
          const read = new Set(prev.filter((n) => !n.unread).map((n) => n.id));
          return alerts.map((a) => ({
            id: `alert-${a.id}`, caseId: a.user_id, caseName: a.victim_name, title: REASON_TITLES[a.reason] ?? 'Alert',
            description: a.message, time: timeAgo(a.at), severity: a.level === 'watch' ? 'medium' as const : 'high' as const,
            unread: !read.has(`alert-${a.id}`),
          }));
        });
      } catch {
        /* the next event or the safety-net poll will catch up */
      }
    }, 350));
  }, [counsellorName, refresh]);

  // The live stream: every reading, score, alert, case problem, summary,
  // message and call-back request for this caseload, as it happens.
  useEffect(() => openLiveStream('/counsellor/stream', {
    onStatus: (up) => {
      setLive(up);
      if (up) refresh();          // catch up on anything missed while disconnected
    },
    onEvent: (e) => {
      emitLive(e);
      if (e.type === 'reading' && typeof e.level === 'number' && e.level >= 2) setFeedUnseen((n) => n + 1);
      if (e.type === 'outreach') loadOutreachCount();
      if (e.victim_id) refreshCase(e.victim_id);
      const name = casesRef.current.find((c) => c.id === e.victim_id)?.name ?? 'A client';
      const text = TOAST_FOR[e.type]?.(e, name);
      if (text) {
        setToastMessage(text);
        window.setTimeout(() => setToastMessage((t) => (t === text ? null : t)), 5000);
      }
    },
  }), [refresh, refreshCase, loadOutreachCount]);

  useEffect(() => {
    if (activeTab === 'live-feed') setFeedUnseen(0);
    window.scrollTo(0, 0);
  }, [activeTab]);

  const openCase = (id: string) => {
    setSelectedCaseId(id);
    setActiveTab('case-detail-signals');
  };

  const badges = {
    'live-feed': feedUnseen,
    'case-issues': cases.reduce((n, c) => n + c.openIssues, 0),
    inbox: cases.reduce((n, c) => n + c.unreadMessages + c.openRequests, 0),
    outreach: escalatedCalls,
  };

  const activeCase = cases.find((c) => c.id === selectedCaseId) || cases[0];
  const unreadNotificationsCount = notifications.filter((n) => n.unread).length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Alert items resolve the real alert; event and routine items are a local checklist
  const handleToggleIntervention = async (caseId: string, interventionId: string) => {
    if (interventionId.startsWith('alert-')) {
      try {
        await api.resolveAlert(Number(interventionId.slice('alert-'.length)), 'Marked done in the Command Centre');
        showToast('Alert resolved');
        await refresh();
      } catch (err) {
        showToast(errorText(err));
      }
      return;
    }
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== caseId) return c;
        const updatedInterventions = c.interventions.map((item) => {
          if (item.id !== interventionId) return item;
          const nextCompleted = !item.completed;
          return {
            ...item,
            completed: nextCompleted,
            status: nextCompleted ? ('Completed' as const) : ('Pending' as const),
          };
        });
        return {
          ...c,
          interventions: updatedInterventions,
        };
      })
    );
  };

  const handleAssignCounsellor = () => {
    showToast('Reassigning cases is not available yet. New victims go to the counsellor with the fewest cases.');
  };

  const handleScheduleFollowUp = async (details: { date: string; time: string; type: string }) => {
    if (!activeCase) return;
    try {
      await api.addEvent(activeCase.id, {
        kind: 'counselling',
        date: isoDay(details.date),
        title: `${details.type}${details.time ? ` at ${details.time}` : ''}`,
      });
      showToast(`Follow-up scheduled for ${details.date}${details.time ? ` at ${details.time}` : ''}`);
      await refresh();
    } catch (err) {
      showToast(errorText(err));
    }
  };

  // Acknowledging the plan acknowledges the case's open alerts
  const handleAcknowledgePlan = async () => {
    if (!activeCase) return;
    const open = activeCase.interventions.filter((i) => i.id.startsWith('alert-') && i.status === 'Pending');
    try {
      await Promise.all(open.map((i) => api.acknowledgeAlert(Number(i.id.slice('alert-'.length)))));
      showToast(open.length ? `Plan acknowledged for ${activeCase.name}` : `Nothing open for ${activeCase.name}`);
      await refresh();
    } catch (err) {
      showToast(errorText(err));
    }
  };

  const handleSyncBaselines = async () => {
    setIsSyncing(true);
    await refresh();
    setIsSyncing(false);
    showToast('Caseload refreshed.');
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const emptyState = loading ? (
    <div className="flex flex-col items-center gap-3 py-24 text-sun">
      <div className="w-8 h-8 rounded-full border-2 border-line border-t-sun animate-spin"></div>
      <span className="text-sm font-semibold">Loading your caseload…</span>
    </div>
  ) : loadError ? (
    <div className="max-w-md mx-auto mt-16 bg-surface rounded-card p-6 border border-line text-center flex flex-col gap-3">
      <p className="text-sm text-ink font-semibold">Couldn't load your caseload</p>
      <p className="text-xs text-ink-2">{loadError}</p>
      <button onClick={refresh} className="text-xs font-semibold text-sun hover:underline">
        Try again
      </button>
    </div>
  ) : (
    <div className="max-w-md mx-auto mt-16 bg-surface rounded-card p-6 border border-line text-center flex flex-col gap-2">
      <p className="text-sm text-ink font-semibold">No one is assigned to you yet</p>
      <p className="text-xs text-ink-2 leading-relaxed">
        New victims are assigned to the counsellor with the fewest cases when they sign up. They'll appear here with
        their check-ins and alerts.
      </p>
    </div>
  );

  return (
    <div className="sahaas flex antialiased">
      {/* Sidebar navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        badges={badges}
        urgent={{ outreach: escalatedCalls > 0 }}
        counsellorName={counsellorName}
        onSignOut={onSignOut}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
          onQuickLock={() => setIsQuickLocked(true)}
          onToggleNotifications={() => setIsNotificationsOpen((prev) => !prev)}
          unreadCount={unreadNotificationsCount}
          live={live}
        />

        {/* Dynamic Page Container (pt-20 clears the fixed 4rem header + breathing room) */}
        <main className="flex-1 pt-24 sm:pt-[104px] px-4 pb-10 sm:px-6 lg:px-10 max-w-6xl w-full mx-auto">
          {activeTab === 'live-feed' ? (
            <LiveFeedView onOpenCase={openCase} connected={live} />
          ) : activeTab === 'case-issues' ? (
            <CaseIssuesView onOpenCase={openCase} clients={cases.map((c) => ({ id: c.id, name: c.name }))} />
          ) : activeTab === 'inbox' ? (
            <InboxView onOpenCase={openCase} />
          ) : activeTab === 'outreach' ? (
            <OutreachView onOpenCase={openCase} />
          ) : activeTab === 'system-settings' ? (
            <SystemSettingsView onOpenHowScoring={() => setActiveTab('how-scoring')} />
          ) : activeTab === 'how-scoring' ? (
            <HowScoringView />
          ) : activeTab === 'forecast' ? (
            <ForecastView
              onOpenCase={(id) => {
                setSelectedCaseId(id);
                setActiveTab('case-detail-signals');
              }}
            />
          ) : !activeCase ? (
            emptyState
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewView
                  cases={cases}
                  counsellorName={counsellorName}
                  selectedCaseId={activeCase.id}
                  onSelectCase={(id) => setSelectedCaseId(id)}
                  onOpenCase={openCase}
                  onOpenScheduleFollowUp={() => setIsScheduleModalOpen(true)}
                  onOpenAuditTrail={() => setIsAuditModalOpen(true)}
                  onAcknowledgePlan={handleAcknowledgePlan}
                  onSyncBaselines={handleSyncBaselines}
                  isSyncing={isSyncing}
                />
              )}

              {activeTab === 'priority-cases' && (
                <PriorityCasesView
                  cases={cases}
                  onSelectCase={(id) => {
                    setSelectedCaseId(id);
                    setActiveTab('overview');
                  }}
                  onNavigateToDetail={(id) => {
                    setSelectedCaseId(id);
                    setActiveTab('case-detail-signals');
                  }}
                />
              )}

              {activeTab === 'case-detail-signals' && (
                <CaseDetailView
                  caseData={activeCase}
                  onOpenAuditTrail={() => setIsAuditModalOpen(true)}
                  onOpenScheduleFollowUp={() => setIsScheduleModalOpen(true)}
                  onOpenAssignCounsellor={handleAssignCounsellor}
                  onChanged={refresh}
                  onBack={() => setActiveTab('priority-cases')}
                />
              )}

              {activeTab === 'interventions' && (
                <InterventionsView
                  cases={cases}
                  onToggleIntervention={handleToggleIntervention}
                  onOpenAssignCounsellor={handleAssignCounsellor}
                  onOpenScheduleFollowUp={() => setIsScheduleModalOpen(true)}
                />
              )}

              {activeTab === 'recovery-outcomes' && (
                <RecoveryOutcomesView
                  cases={cases}
                  onOpenAuditTrail={() => setIsAuditModalOpen(true)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating Action Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-ink text-canvas px-4 py-3 rounded-tile shadow-xl flex items-center gap-2.5 animate-fadeIn max-w-sm"
             role="status" aria-live="polite">
          <span className="material-symbols-outlined text-[20px]">notifications_active</span>
          <span className=" text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Quick Lock Modal */}
      <QuickLockModal
        isOpen={isQuickLocked}
        onUnlock={() => {
          setIsQuickLocked(false);
          showToast(`Session unlocked. Welcome back, ${counsellorName}.`);
        }}
      />

      {/* Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onSelectCase={(id) => {
          setSelectedCaseId(id);
          setActiveTab('overview');
        }}
        onMarkAllRead={handleMarkAllNotificationsRead}
      />

      {activeCase && (
        <>
          {/* Schedule Follow-up Modal */}
          <ScheduleFollowUpModal
            isOpen={isScheduleModalOpen}
            onClose={() => setIsScheduleModalOpen(false)}
            currentCase={activeCase}
            onSchedule={handleScheduleFollowUp}
          />

          {/* Audit Trail Modal */}
          <AuditTrailModal
            isOpen={isAuditModalOpen}
            onClose={() => setIsAuditModalOpen(false)}
            currentCase={activeCase}
          />
        </>
      )}
    </div>
  );
}
