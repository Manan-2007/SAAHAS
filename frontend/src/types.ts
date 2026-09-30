export type LanguageCode = 'en' | 'hi' | 'pa';

/** A well-being row: trend words only, never a score (from GET /me/wellbeing). */
export interface WellBeingMetric {
  id: string;
  name: string;
  description: string;
  trend: 'Improving' | 'Stable' | 'Rest needed' | 'Elevated';
  icon: string;
  category: 'stress' | 'energy' | 'fatigue';
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
