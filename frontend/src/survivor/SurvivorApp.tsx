import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useLanguage } from '../i18n/LanguageProvider';
import { DEFAULT_CRISIS_MESSAGE } from './data/crisis';
import { FALLBACK_HELPLINES, Feeling, useSupportInfo } from './data/survivorData';
import { LiveEvent, openLiveStream } from '../lib/liveStream';
import { useHistoryRoute } from './navigation';
import { SurvivorContext, SurvivorContextValue } from './SurvivorContext';
import { AppShell } from './shell/AppShell';
import { HelplineSheet } from './shell/HelplineSheet';
import { Home } from './screens/Home';
import { Chat } from './screens/Chat';
import { Voice } from './screens/Voice';
import { VoiceCheckIn } from './screens/VoiceCheckIn';
import { CheckIn } from './screens/CheckIn';
import { WellbeingScreen } from './screens/Wellbeing';
import { Breathe } from './screens/Breathe';
import { SupportScreen } from './screens/Support';
import { Counsellor } from './screens/Counsellor';
import { Rights } from './screens/Rights';
import { Prepare } from './screens/Prepare';
import { Problem } from './screens/Problem';
import { Privacy } from './screens/Privacy';
import './survivor.css';

type LiveListener = (event: LiveEvent) => void;

/**
 * The survivor-facing app. It owns what every screen shares: where we are,
 * the helpline sheet, whether a real crisis signal has been seen this session,
 * the counsellor's contact card, and one live connection for replies.
 */
export const SurvivorApp: React.FC<{ onQuickExit: () => void }> = ({ onQuickExit }) => {
  const { user } = useAuth();
  const { setLanguage } = useLanguage();
  const isVictim = user.role === 'victim';
  const isGuest = user.role === 'guest';
  const { route, navigate, back } = useHistoryRoute();
  const [helplinesOpen, setHelplinesOpen] = useState(false);
  const [crisis, setCrisis] = useState<string | null>(null);
  const [lastFeeling, setLastFeeling] = useState<Feeling | null>(null);
  const support = useSupportInfo(isVictim);
  const listeners = useRef(new Set<LiveListener>());

  // A signed-in person's account language wins over whatever was picked
  // before signing in. Guests keep their choice.
  useEffect(() => {
    if (!isGuest) setLanguage(user.language);
  }, [user.id, user.language, isGuest, setLanguage]);

  // One live stream for the whole app: counsellor replies, call-back updates.
  const { reload: reloadSupport } = support;
  useEffect(() => {
    if (!isVictim) return;
    return openLiveStream('/me/stream', {
      onEvent: (event) => {
        if (event.type === 'message' || event.type === 'contact_request') reloadSupport();
        listeners.current.forEach((l) => l(event));
      },
    });
  }, [isVictim, reloadSupport]);

  const raiseCrisis = useCallback((message?: string | null) => {
    setCrisis((current) => message || current || DEFAULT_CRISIS_MESSAGE);
  }, []);

  const value: SurvivorContextValue = useMemo(
    () => ({
      route,
      navigate,
      back,
      openHelplines: () => setHelplinesOpen(true),
      crisis,
      raiseCrisis,
      lastFeeling,
      setLastFeeling,
      quickExit: onQuickExit,
      isVictim,
      isGuest,
      counsellor: support.data?.counsellor ?? null,
      helplines: support.data?.helplines?.length ? support.data.helplines : FALLBACK_HELPLINES,
      missedCall: support.data?.missed_call ?? null,
      unreadMessages: support.data?.unread_messages ?? 0,
      reloadSupport,
      subscribe: (listener: LiveListener) => {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
    }),
    [route, navigate, back, crisis, raiseCrisis, lastFeeling, onQuickExit, isVictim, isGuest, support.data, reloadSupport],
  );

  const screen = (() => {
    switch (route.name) {
      case 'chat':
        return <Chat />;
      case 'voice':
        return <Voice />;
      case 'voice-checkin':
        return <VoiceCheckIn />;
      case 'checkin':
        return <CheckIn />;
      case 'wellbeing':
        return <WellbeingScreen />;
      case 'breathe':
        return <Breathe initialMode={route.params?.mode} />;
      case 'support':
        return <SupportScreen />;
      case 'counsellor':
        return <Counsellor />;
      case 'rights':
        return <Rights />;
      case 'prepare':
        return <Prepare />;
      case 'problem':
        return <Problem initialCategory={route.params?.category} />;
      case 'privacy':
        return <Privacy />;
      default:
        return <Home />;
    }
  })();

  return (
    <SurvivorContext.Provider value={value}>
      <AppShell>
        <div key={`${route.name}:${JSON.stringify(route.params ?? {})}`}>{screen}</div>
      </AppShell>
      <HelplineSheet open={helplinesOpen} onClose={() => setHelplinesOpen(false)} />
    </SurvivorContext.Provider>
  );
};
