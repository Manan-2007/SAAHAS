import { createContext, useContext } from 'react';
import type { Route, RouteName, RouteParams } from './navigation';
import type { Feeling } from './data/survivorData';
import type { Helpline, SupportInfo } from '../lib/api';
import type { LiveEvent } from '../lib/liveStream';

export interface SurvivorContextValue {
  route: Route;
  navigate: (name: RouteName, params?: RouteParams) => void;
  back: () => void;
  /** The helpline sheet: every free line, one tap each. */
  openHelplines: () => void;
  /**
   * Set only by a real crisis signal (crisis: true from chat, voice, a
   * check-in or a message, or chat's local safety net) and kept for the
   * session, so Support leads with the emergency lines until the app closes.
   * Nothing in the UI invents one.
   */
  crisis: string | null;
  raiseCrisis: (message?: string | null) => void;
  /** The feeling picked in this session's check-in, for Home's "you checked in today". */
  lastFeeling: Feeling | null;
  setLastFeeling: (feeling: Feeling) => void;
  quickExit: () => void;
  isVictim: boolean;
  isGuest: boolean;
  /** From /me/support: who the counsellor is and how to reach them, when known. */
  counsellor: SupportInfo['counsellor'];
  helplines: Helpline[];
  unreadMessages: number;
  reloadSupport: () => void;
  /** Live events from /me/stream (one connection, shared). Returns an unsubscribe. */
  subscribe: (listener: (event: LiveEvent) => void) => () => void;
}

export const SurvivorContext = createContext<SurvivorContextValue | null>(null);

export function useSurvivor(): SurvivorContextValue {
  const ctx = useContext(SurvivorContext);
  if (!ctx) throw new Error('useSurvivor must be used within the survivor app');
  return ctx;
}
