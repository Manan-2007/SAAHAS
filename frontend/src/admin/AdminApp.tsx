import React, { useCallback, useEffect, useState } from 'react';
import { CaseData, NavigationTab, NotificationItem } from './types';
import { loadCaseload } from './data/live';
import { ApiError, api } from '../lib/api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './components/OverviewView';
import { PriorityCasesView } from './components/PriorityCasesView';
import { CaseDetailView } from './components/CaseDetailView';
import { InterventionsView } from './components/InterventionsView';
import { RecoveryOutcomesView } from './components/RecoveryOutcomesView';
import { ForecastView } from './components/ForecastView';
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

const REFRESH_MS = 60_000;     // new alerts appear without a reload

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
    <div className="flex flex-col items-center gap-3 py-24 text-[#9c6743]">
      <div className="w-8 h-8 rounded-full border-2 border-[#e7d3b5] border-t-[#9c6743] animate-spin"></div>
      <span className="text-sm font-semibold">Loading your caseload…</span>
    </div>
  ) : loadError ? (
    <div className="max-w-md mx-auto mt-16 bg-white rounded-2xl p-6 border border-[#e5dac4] text-center flex flex-col gap-3">
      <p className="text-sm text-[#352e24] font-semibold">Couldn't load your caseload</p>
      <p className="text-xs text-[#5c5142]">{loadError}</p>
      <button onClick={refresh} className="text-xs font-semibold text-[#9c6743] hover:underline">
        Try again
      </button>
    </div>
  ) : (
    <div className="max-w-md mx-auto mt-16 bg-white rounded-2xl p-6 border border-[#e5dac4] text-center flex flex-col gap-2">
      <p className="text-sm text-[#352e24] font-semibold">No one is assigned to you yet</p>
      <p className="text-xs text-[#5c5142] leading-relaxed">
        New victims are assigned to the counsellor with the fewest cases when they sign up. They'll appear here with
        their check-ins and alerts.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#352e24] flex font-['Plus_Jakarta_Sans'] antialiased">
      {/* Sidebar navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          counsellorName={counsellorName}
          onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
          onSignOut={onSignOut}
          onQuickLock={() => setIsQuickLocked(true)}
          onToggleNotifications={() => setIsNotificationsOpen((prev) => !prev)}
          unreadCount={unreadNotificationsCount}
        />

        {/* Dynamic Page Container (pt-20 clears the fixed 4rem header + breathing room) */}
        <main className="flex-1 pt-20 sm:pt-24 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8 max-w-7xl w-full mx-auto">
          {activeTab === 'system-settings' ? (
            <SystemSettingsView />
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
                  selectedCaseId={activeCase.id}
                  onSelectCase={(id) => setSelectedCaseId(id)}
                  onToggleIntervention={handleToggleIntervention}
                  onOpenAssignCounsellor={handleAssignCounsellor}
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
        <div className="fixed bottom-6 right-6 z-50 bg-[#9c6743] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 animate-fadeIn max-w-sm">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span className="font-['Inter'] text-xs font-semibold">{toastMessage}</span>
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
