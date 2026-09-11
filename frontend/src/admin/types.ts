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
  status: 'Stable' | 'Changed' | 'Reduced' | 'High Stress' | 'Improving';
  statusColor: 'secondary' | 'amber' | 'error' | 'primary';
}

export interface CaseData {
  id: string;
  number: string;
  name: string;
  initials: string;
  registeredDate: string;
  assignedCounsellor: string;
  status: 'Silent Deterioration Detected' | 'Voice Acoustic Tension' | 'Follow-up Required' | 'Stabilizing • Recovery Tracking' | 'Court Stress Alert';
  statusType: 'error' | 'amber' | 'info' | 'success';
  timeAgo: string;
  keyHighlight: string;
  keyHighlightIcon: string;
  keyHighlightColor: 'error' | 'amber' | 'primary' | 'secondary' | 'tertiary';
  subHighlight: string;
  
  // Vitals
  wellbeingIndex: number;
  wellbeingDelta: string;
  fatigueMarker: number;
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
    missedCheckins: number;
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
  distressBefore: number;
  distressBeforeLabel: string;
  distressAfter: number;
  distressAfterLabel: string;
  distressDelta: string;
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
