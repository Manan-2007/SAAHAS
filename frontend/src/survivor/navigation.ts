// Screen routing for the survivor app.
//
// The phone's back button has to work, but where someone has been must not be
// readable from the address bar or the browser history on a shared phone. So
// every screen change is a history entry with the SAME url: the route lives in
// history.state only. Back walks through screens; the url never says "#/support".

import { useCallback, useEffect, useRef, useState } from 'react';

export type RouteName =
  | 'home'
  | 'chat'
  | 'voice'
  | 'voice-checkin'
  | 'checkin'
  | 'wellbeing'
  | 'breathe'
  | 'support'
  | 'counsellor'
  | 'rights'
  | 'prepare'
  | 'problem'
  | 'privacy';

export interface RouteParams {
  /** breathe: open straight into grounding */
  mode?: 'breathe' | 'ground';
  /** problem: a category picked from "my rights" */
  category?: string;
}

export interface Route {
  name: RouteName;
  params?: RouteParams;
}

export type Tab = 'home' | 'chat' | 'voice' | 'wellbeing' | 'support';

/** Which bottom-nav tab a screen belongs to. */
export const TAB_OF: Record<RouteName, Tab> = {
  home: 'home',
  chat: 'chat',
  voice: 'voice',
  'voice-checkin': 'voice',
  checkin: 'wellbeing',
  wellbeing: 'wellbeing',
  breathe: 'wellbeing',
  support: 'support',
  counsellor: 'support',
  rights: 'support',
  prepare: 'support',
  problem: 'support',
  privacy: 'support',
};

/** Focused screens: the bottom nav steps aside. Quick Exit never does. */
export const IMMERSIVE = new Set<RouteName>(['checkin', 'breathe']);

const KEY = 'sahaas';
const HOME: Route = { name: 'home' };

interface Entry {
  route: Route;
  depth: number;
}

const read = (state: unknown): Entry | null => {
  const entry = (state as Record<string, Entry> | null)?.[KEY];
  return entry && typeof entry.route?.name === 'string' ? entry : null;
};

const same = (a: Route, b: Route) =>
  a.name === b.name && JSON.stringify(a.params ?? {}) === JSON.stringify(b.params ?? {});

export function useHistoryRoute() {
  // The app always opens at home, whatever the last session was looking at.
  const [route, setRoute] = useState<Route>(HOME);
  const depth = useRef(0);
  const current = useRef<Route>(HOME);

  useEffect(() => {
    window.history.replaceState({ ...window.history.state, [KEY]: { route: HOME, depth: 0 } }, '');
    const onPop = (e: PopStateEvent) => {
      const entry = read(e.state);
      const next = entry?.route ?? HOME;
      depth.current = entry?.depth ?? 0;
      current.current = next;
      setRoute(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((name: RouteName, params?: RouteParams) => {
    const next: Route = params ? { name, params } : { name };
    if (same(next, current.current)) return;
    depth.current += 1;
    window.history.pushState({ [KEY]: { route: next, depth: depth.current } }, '');
    current.current = next;
    setRoute(next);
  }, []);

  /** Back one screen; from the first screen, home. */
  const back = useCallback(() => {
    if (depth.current > 0) {
      window.history.back();
      return;
    }
    window.history.replaceState({ [KEY]: { route: HOME, depth: 0 } }, '');
    current.current = HOME;
    setRoute(HOME);
  }, []);

  return { route, navigate, back };
}
