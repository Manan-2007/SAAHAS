export type NavigationTab = 
  | 'overview' 
  | 'priority-cases' 
  | 'case-detail-signals' 
  | 'interventions' 
  | 'recovery-outcomes' 
  | 'system-settings';

export interface InterventionItem {
  id: string;
  title: string;
  subtitle: string;
  assignedTo: string;
  priority: string;
  status: 'In Progress' | 'Pending' | 'Scheduled' | 'Optional' | 'Completed';
  completed: boolean;
}

export interface MultimodalSignal {
  type: 'text' | 'voice' | 'engagement' | 'legal';
  label: string;
  description: string;
  status: 'Stable' | 'Changed' | 'Reduced' | 'High Stress' | 'Improving' | 'No data';
  statusColor: 'secondary' | 'amber' | 'error' | 'primary';
}

export interface CaseData {
  id: string;
  number: string;
  name: string;
  initials: string;
  registeredDate: string;
  assignedCounsellor: string;
  status: string;          // e.g. 'Crisis Signal', 'Silent Deterioration Detected' (data/live.ts)
  statusType: 'error' | 'amber' | 'info' | 'success';
  timeAgo: string;
  keyHighlight: string;
  keyHighlightIcon: string;
  keyHighlightColor: 'error' | 'amber' | 'primary' | 'secondary' | 'tertiary';
  subHighlight: string;
  
  // Vitals ("—" where the backend has no data yet)
  wellbeingIndex: number | string;     // the Distress Score, 0-100
  wellbeingDelta: string;
  fatigueMarker: number | string;      // the voice component, 0-100
  fatigueDelta: string;
  escalationRisk: 'HIGH' | 'MODERATE' | 'LOW' | 'STABLE';
  escalationReason: string;

  // Silent Deterioration or Primary Alert
  alertTitle: string;
  alertConfCode: string;
  alertDescription: string;
  metrics: {
    responseLengthDelta: string;
    responseLengthNote: string;
    responseLatencyDelta: string;
    responseLatencyNote: string;
    voiceDurationDelta: string;
    voiceDurationNote: string;
    missedCheckins: number | string;
    missedCheckinsNote: string;
  };

  // Multimodal Matrix
  signals: MultimodalSignal[];

  // AI Confidence
  aiConfidencePct: number;
  aiConfidenceLabel: string;
  aiConfidenceDescription: string;
  explainableRuleId: string;

  // Intervention Plan
  whyRecommended: string;
  interventions: InterventionItem[];

  // Closed-loop Recovery
  cohortImprovementPct: string;
  distressBefore: number | string;
  distressBeforeLabel: string;
  distressAfter: number | string;
  distressAfterLabel: string;
  distressDelta: string;
  trendPoints: number[];   // Distress Score history, last 30 days
  currentStep: number; // 1 to 5
}

export interface NotificationItem {
  id: string;
  caseId: string;
  caseName: string;
  title: string;
  description: string;
  time: string;
  severity: 'high' | 'medium' | 'info';
  unread: boolean;
}
