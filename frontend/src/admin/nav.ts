import type { NavigationTab } from './types';

// The Command Centre's navigation, grouped by what a counsellor is doing:
// seeing people, being in contact, reviewing how care is going.

export interface NavItem {
  id: NavigationTab;
  label: string;
  icon: string;
}

export const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  { items: [{ id: 'overview', label: 'Today', icon: 'home' }] },
  {
    label: 'People',
    items: [
      { id: 'priority-cases', label: 'Caseload', icon: 'group' },
      { id: 'forecast', label: 'This week', icon: 'calendar_month' },
      { id: 'case-issues', label: 'Case problems', icon: 'gavel' },
    ],
  },
  {
    label: 'Contact',
    items: [
      { id: 'inbox', label: 'Messages', icon: 'mail' },
      { id: 'outreach', label: 'Check-in calls', icon: 'phone_callback' },
      { id: 'live-feed', label: 'Live feed', icon: 'sensors' },
    ],
  },
  {
    label: 'Review',
    items: [
      { id: 'interventions', label: 'Care plans', icon: 'checklist' },
      { id: 'recovery-outcomes', label: 'Outcomes', icon: 'trending_up' },
    ],
  },
];

/** Pages that aren't in the nav light up their parent instead. */
export const NAV_PARENT: Partial<Record<NavigationTab, NavigationTab>> = {
  'case-detail-signals': 'priority-cases',
  'how-scoring': 'system-settings',
};
