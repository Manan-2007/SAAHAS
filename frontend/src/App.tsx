import React, { useState, lazy, Suspense } from 'react';
import { AppView, UserPersona, LanguageCode, WellBeingMetric } from './types';
import { INITIAL_WELLBEING_METRICS } from './data/mockData';
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

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('home-dashboard');
  const [persona, setPersona] = useState<UserPersona>('victim');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [isQuickExited, setIsQuickExited] = useState(false);
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string>('calm');
  const [metrics, setMetrics] = useState<WellBeingMetric[]>(INITIAL_WELLBEING_METRICS);

  // Quick Safety Exit triggered: instantly mask with realistic decoy
  const handleQuickExit = () => {
    setIsQuickExited(true);
  };

  const handleRestoreSanctuary = () => {
    setIsQuickExited(false);
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
    return <QuickExitDecoy onRestoreSanctuary={handleRestoreSanctuary} />;
  }

  // Counsellor Command Centre is a full-screen dashboard with its own sidebar
  // and header, so it takes over the shell instead of nesting in the user chrome.
  if (currentView === 'counsellor-command-centre') {
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
        <AdminApp
          onExitToUser={() => {
            setPersona('victim');
            setCurrentView('home-dashboard');
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#352e24] flex flex-col font-sans selection:bg-[#e7d3b5] selection:text-[#7a5a3f]">
      {/* Top Header */}
      <Header
        currentView={currentView}
        persona={persona}
        language={language}
        onLanguageChange={setLanguage}
        onPersonaChange={setPersona}
        onQuickExit={handleQuickExit}
        onNavigate={setCurrentView}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-24 pb-24 min-h-screen overflow-x-hidden">
        {currentView === 'home-dashboard' && (
          <HomeDashboard
            language={language}
            onNavigate={setCurrentView}
            onPersonaChange={setPersona}
            onOpenCall={() => setIsCallOpen(true)}
            selectedMood={selectedMood}
            onMoodSelect={setSelectedMood}
            metrics={metrics}
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
            metrics={metrics}
            onUpdateMetric={handleUpdateMetric}
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
