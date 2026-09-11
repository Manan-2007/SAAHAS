import React, { useState } from 'react';
import { INITIAL_CASES, INITIAL_NOTIFICATIONS } from './data/cases';
import { CaseData, NavigationTab, NotificationItem } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './components/OverviewView';
import { PriorityCasesView } from './components/PriorityCasesView';
import { CaseDetailView } from './components/CaseDetailView';
import { InterventionsView } from './components/InterventionsView';
import { RecoveryOutcomesView } from './components/RecoveryOutcomesView';
import { SystemSettingsView } from './components/SystemSettingsView';
import {
  QuickLockModal,
  NotificationDrawer,
  AssignCounsellorModal,
  ScheduleFollowUpModal,
  AuditTrailModal,
} from './components/Modals';

interface AdminAppProps {
  /** Returns to the SAAHAS survivor (user) interface. */
  onExitToUser: () => void;
}

// Counsellor Command Centre — the trauma-informed monitoring dashboard that
// realizes the Dynamic Distress Score vision from the SAAHAS proposal.
// Adapted from reference/rough_work/admin into the SAAHAS frontend: the former
// internal "client mode" is replaced by onExitToUser, which hands control back
// to the survivor-facing app shell.
export default function AdminApp({ onExitToUser }: AdminAppProps) {
  const [cases, setCases] = useState<CaseData[]>(INITIAL_CASES);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('2048');
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  // View state flags
  const [isQuickLocked, setIsQuickLocked] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeCase = cases.find((c) => c.id === selectedCaseId) || cases[0];
  const unreadNotificationsCount = notifications.filter((n) => n.unread).length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleToggleIntervention = (caseId: string, interventionId: string) => {
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

  const handleAssignCounsellor = (counsellor: string) => {
    setCases((prev) =>
      prev.map((c) => (c.id === selectedCaseId ? { ...c, assignedCounsellor: counsellor } : c))
    );
    showToast(`Case ${activeCase.number} assigned to ${counsellor}`);
  };

  const handleScheduleFollowUp = (details: { date: string; time: string; type: string }) => {
    showToast(`Follow-up scheduled for ${details.date} at ${details.time}`);
  };

  const handleAcknowledgePlan = () => {
    showToast(`Protocol plan certified by Dr. Ananya Rao for ${activeCase.name}`);
  };

  const handleSyncBaselines = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      showToast('Multimodal telemetry baselines synchronized successfully.');
    }, 1200);
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

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
          onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
          onSwitchToClientMode={onExitToUser}
          onQuickLock={() => setIsQuickLocked(true)}
          onToggleNotifications={() => setIsNotificationsOpen((prev) => !prev)}
          unreadCount={unreadNotificationsCount}
        />

        {/* Dynamic Page Container (pt-20 clears the fixed 4rem header + breathing room) */}
        <main className="flex-1 pt-20 sm:pt-24 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              cases={cases}
              selectedCaseId={selectedCaseId}
              onSelectCase={(id) => setSelectedCaseId(id)}
              onToggleIntervention={handleToggleIntervention}
              onOpenAssignCounsellor={() => setIsAssignModalOpen(true)}
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
              onOpenAssignCounsellor={() => setIsAssignModalOpen(true)}
            />
          )}

          {activeTab === 'interventions' && (
            <InterventionsView
              cases={cases}
              onToggleIntervention={handleToggleIntervention}
              onOpenAssignCounsellor={() => setIsAssignModalOpen(true)}
              onOpenScheduleFollowUp={() => setIsScheduleModalOpen(true)}
            />
          )}

          {activeTab === 'recovery-outcomes' && (
            <RecoveryOutcomesView
              cases={cases}
              onOpenAuditTrail={() => setIsAuditModalOpen(true)}
            />
          )}

          {activeTab === 'system-settings' && <SystemSettingsView />}
        </main>
      </div>

      {/* Floating Action Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#9c6743] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 animate-fadeIn">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span className="font-['Inter'] text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Quick Lock Modal */}
      <QuickLockModal
        isOpen={isQuickLocked}
        onUnlock={() => {
          setIsQuickLocked(false);
          showToast('Session unlocked. Welcome back Dr. Rao.');
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

      {/* Assign Counsellor Modal */}
      <AssignCounsellorModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        currentCase={activeCase}
        onAssign={handleAssignCounsellor}
      />

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
    </div>
  );
}
