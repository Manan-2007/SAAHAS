import React, { Suspense, lazy } from 'react';
import { useAuth } from './auth/AuthProvider';
import { SurvivorApp } from './survivor/SurvivorApp';

// The counsellor dashboard is a large, separate surface — lazy-load it so the
// survivor-facing app stays lean and never downloads the admin bundle.
const AdminApp = lazy(() => import('./admin/AdminApp'));

export default function App() {
  const { user, logout, lock } = useAuth();

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

  // The survivor "Exit" button signs out: it wipes the session on this device
  // and returns to the welcome / sign-in screen (no decoy).
  return <SurvivorApp onQuickExit={lock} />;
}
