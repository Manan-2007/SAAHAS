import React, { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { AppView, LanguageCode, WellBeingMetric } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeDashboard } from './components/HomeDashboard';
import { SafeChat } from './components/SafeChat';
import { VoiceCompanion } from './components/VoiceCompanion';
import { WellBeingTracker } from './components/WellBeingTracker';
import { SupportLegalPrep } from './components/SupportLegalPrep';
// The counsellor dashboard is a large, separate surface — lazy-load it so the
// survivor-facing app stays lean and never downloads the admin bundle.
const AdminApp = lazy(() => import('./admin/AdminApp'));
import { QuickExitDecoy } from './components/QuickExitDecoy';
import { CallModal } from './components/CallModal';
import { useAuth } from './auth/AuthProvider';
import { Wellbeing, api, clearSession } from './lib/api';
import { STARTING_METRICS, applyWellbeing } from './lib/wellbeing';

export default function App() {
  const { user, logout, lock } = useAuth();
  const isVictim = user.role === 'victim';
  const [currentView, setCurrentView] = useState<AppView>('home-dashboard');
  const [language, setLanguage] = useState<LanguageCode>(user.language);
  const [isQuickExited, setIsQuickExited] = useState(false);
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string>('calm');
  const [metrics, setMetrics] = useState<WellBeingMetric[]>(STARTING_METRICS);
  const [wellbeingMessage, setWellbeingMessage] = useState<string | null>(null);

  const showWellbeing = useCallback((w: Wellbeing) => {
    setMetrics((m) => applyWellbeing(m, w));
    setWellbeingMessage(w.message);
  }, []);

  // The home rows come from the victim's own check-ins (trend words, never scores)
  useEffect(() => {
    if (!isVictim) return;
    let live = true;
    api.wellbeing().then((w) => live && showWellbeing(w)).catch(() => {});
    return () => {
      live = false;
    };
  }, [isVictim, showWellbeing]);

  // Quick Safety Exit: the token is wiped at once and the decoy covers the
  // screen. Coming back needs a fresh sign-in, so whoever picks up the phone
  // next can't just tap back in.
  const handleQuickExit = () => {
    clearSession();
    setIsCallOpen(false);
    setIsQuickExited(true);
  };

  const handleUpdateMetric = (metricId: string, status: string, description?: string) => {
    setMetrics(prev =>
      prev.map(m =>
        m.id === metricId
          ? { ...m, trend: status as WellBeingMetric['trend'], ...(description ? { description } : {}) }
          : m
      )
    );
  };

  // If in emergency quick-exit decoy mode:
  if (isQuickExited) {
    return <QuickExitDecoy onRestoreSanctuary={lock} />;
  }

  // Counsellors sign in to the Command Centre: a full-screen dashboard with its
  // own sidebar and header. Victims never reach it - it shows scores.
  if (user.role === 'counsellor') {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#f5f1e8] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-[#9c6743]">
              <div className="w-8 h-8 rounded-full border-2 border-[#e7d3b5] border-t-[#9c6743] animate-spin"></div>
              <span className="text-sm font-semibold">Opening Command Centre…</span>
            </div>
          </div>
        }
      >
        <AdminApp counsellorName={user.name} onSignOut={logout} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#352e24] flex flex-col font-sans selection:bg-[#e7d3b5] selection:text-[#7a5a3f]">
      {/* Top Header */}
      <Header
        currentView={currentView}
        language={language}
        onLanguageChange={setLanguage}
        onQuickExit={handleQuickExit}
        onNavigate={setCurrentView}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-24 pb-24 min-h-screen overflow-x-hidden">
        {currentView === 'home-dashboard' && (
          <HomeDashboard
            language={language}
            onNavigate={setCurrentView}
            onOpenCall={() => setIsCallOpen(true)}
            selectedMood={selectedMood}
            onMoodSelect={setSelectedMood}
            metrics={metrics}
            wellbeingMessage={wellbeingMessage}
          />
        )}

        {currentView === 'safe-chat' && (
          <SafeChat
            onBack={() => setCurrentView('home-dashboard')}
            onOpenCall={() => setIsCallOpen(true)}
            onUpdateMetric={handleUpdateMetric}
          />
        )}

        {currentView === 'voice-companion' && (
          <VoiceCompanion
            onBack={() => setCurrentView('home-dashboard')}
            onUpdateMetric={handleUpdateMetric}
          />
        )}

        {currentView === 'well-being' && (
          <WellBeingTracker
            onBack={() => setCurrentView('home-dashboard')}
            language={language}
            onWellbeing={showWellbeing}
            onOpenCall={() => setIsCallOpen(true)}
          />
        )}

        {(currentView === 'support-network' || currentView === 'legal-prep') && (
          <SupportLegalPrep
            onBack={() => setCurrentView('home-dashboard')}
            onOpenCall={() => setIsCallOpen(true)}
          />
        )}
      </main>

      {/* Bottom Navigation (Only visible in User views, or accessible always) */}
      <BottomNav
        currentView={currentView}
        language={language}
        onNavigate={setCurrentView}
      />

      {/* Private Voice Call Modal */}
      <CallModal
        isOpen={isCallOpen}
        onClose={() => setIsCallOpen(false)}
      />
    </div>
  );
}
