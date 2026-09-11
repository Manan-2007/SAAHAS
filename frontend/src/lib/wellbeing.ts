// The home dashboard's Stress / Energy / Fatigue rows, from GET /me/wellbeing.
// Trend words only - victims never see scores.

import type { WellBeingMetric } from '../types';
import type { Trend, Wellbeing } from './api';
import { INITIAL_WELLBEING_METRICS } from '../data/mockData';

const WAITING = 'Check in to see how this is going';

const DESCRIPTIONS: Record<WellBeingMetric['category'], Record<Trend, string>> = {
  stress: {
    Improving: 'Easing compared with last week',
    Stable: 'Holding steady',
    Elevated: 'A little heavier lately',
    'Rest needed': 'Worth taking things slowly',
  },
  energy: {
    Improving: 'Picking up',
    Stable: 'Holding steady at your usual level',
    Elevated: 'Running high lately',
    'Rest needed': 'Running low - rest counts too',
  },
  fatigue: {
    Improving: 'Easing',
    Stable: 'Sleep and rest seem steady',
    Elevated: 'More tired than usual',
    'Rest needed': 'Sleep has been harder - be gentle with yourself',
  },
};

// Before the first check-in there's nothing to report: steady rows, no invented history
export const STARTING_METRICS: WellBeingMetric[] = INITIAL_WELLBEING_METRICS.map((m) => ({
  ...m,
  trend: 'Stable',
  description: WAITING,
}));

export function applyWellbeing(metrics: WellBeingMetric[], w: Wellbeing): WellBeingMetric[] {
  return metrics.map((m) => {
    const trend = w[m.category];
    return { ...m, trend, description: w.has_data ? DESCRIPTIONS[m.category][trend] : WAITING };
  });
}
