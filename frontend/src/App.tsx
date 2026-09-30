import React, { Suspense, lazy, useState } from 'react';
import { QuickExitDecoy } from './components/QuickExitDecoy';
import { useAuth } from './auth/AuthProvider';
import { clearSession } from './lib/api';
import { SurvivorApp } from './survivor/SurvivorApp';

// The counsellor dashboard is a large, separate surface — lazy-load it so the
// survivor-facing app stays lean and never downloads the admin bundle.
const AdminApp = lazy(() => import('./admin/AdminApp'));

export default function App() {
  const { user, logout, lock } = useAuth();
  const [isQuickExited, setIsQuickExited] = useState(false);

  // Quick Safety Exit: the token is wiped at once and the decoy covers the
  // screen. Coming back needs a fresh sign-in, so whoever picks up the phone
  // next can't just tap back in. Leaving the survivor app also ends any live
  // voice session and releases the microphone.
  const handleQuickExit = () => {
    clearSession();
    setIsQuickExited(true);
  };

  if (isQuickExited) {
    return <QuickExitDecoy onRestoreSanctuary={lock} />;
  }

  // Counsellors sign in to the Command Centre: a full-screen dashboard with its
  // own sidebar and header. Victims never reach it - it shows scores.
  if (user.role === 'counsellor') {
    return (
      <Suspense
        fallback={
          <div className="sahaas flex items-center justify-center" role="status">
            <div className="flex flex-col items-center gap-3 text-ink-2">
              <div className="w-8 h-8 rounded-full border-2 border-line-strong border-t-sun animate-spin"></div>
              <span className="text-sm font-semibold">Opening Command Centre…</span>
            </div>
          </div>
        }
      >
        <AdminApp counsellorName={user.name} onSignOut={logout} />
      </Suspense>
    );
  }

  return <SurvivorApp onQuickExit={handleQuickExit} />;
}
