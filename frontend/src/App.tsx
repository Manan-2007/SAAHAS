import React, { useState } from 'react';
import { AppView, UserPersona, LanguageCode, WellBeingMetric } from './types';
import { INITIAL_WELLBEING_METRICS } from './data/mockData';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeDashboard } from './components/HomeDashboard';
import { SafeChat } from './components/SafeChat';
import { VoiceCompanion } from './components/VoiceCompanion';
import { WellBeingTracker } from './components/WellBeingTracker';
import { SupportLegalPrep } from './components/SupportLegalPrep';
import { CounsellorCommandCentre } from './components/CounsellorCommandCentre';
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

  return (
    <div className="min-h-screen bg-[#f4faff] text-[#111d23] flex flex-col font-sans selection:bg-[#a3ede4] selection:text-[#1d6e67]">
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

        {currentView === 'counsellor-command-centre' && (
          <CounsellorCommandCentre
            onBack={() => setCurrentView('home-dashboard')}
            onPersonaChange={setPersona}
            onOpenCall={() => setIsCallOpen(true)}
            onNavigate={setCurrentView}
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
