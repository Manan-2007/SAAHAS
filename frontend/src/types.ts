export type AppView = 
  | 'home-dashboard' 
  | 'safe-chat' 
  | 'voice-companion' 
  | 'voice-call' 
  | 'well-being' 
  | 'support-network'
  | 'legal-prep' 
  | 'counsellor-command-centre';

export type UserPersona = 'victim' | 'admin';

export type LanguageCode = 'en' | 'hi' | 'pa';

export type MoodType = 'calm' | 'uneasy' | 'heavy' | 'hopeful' | 'resting';

export interface WellBeingMetric {
  id: string;
  name: string;
  description: string;
  trend: 'Improving' | 'Stable' | 'Rest needed' | 'Elevated';
  icon: string;
  category: 'stress' | 'energy' | 'fatigue';
}

export interface ScheduledEvent {
  id: string;
  month: string;
  day: string;
  title: string;
  timing: string;
  tag: string;
  tagIcon: string;
  actionLabel?: string;
  actionView?: AppView;
  isConfirmed?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'sahaas' | 'counsellor';
  senderName: string;
  text: string;
  timestamp: string;
  isAudio?: boolean;
  audioDuration?: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  age: number;
  caseRef: string;
  status: 'Stable' | 'Attention' | 'Immediate Care';
  lastCheckIn: string;
  nextHearing: string;
  assignedCounsellor: string;
  notes: string;
  recentTrends: {
    stress: string;
    energy: string;
    fatigue: string;
  };
}
