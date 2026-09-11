// Turns backend emotion readings into the app's gentle, non-clinical
// language: a session summary, a reflection, and well-being trend updates.
// Shared by the Voice Check-in and chat voice notes.
import { WellBeingMetric } from '../types';
import { EMOTIONS, Emotion, EmotionReading } from './emotionApi';

export type Trend = WellBeingMetric['trend'];

export const MIN_VOICED_FOR_METRICS = 2;

export const TONE_WORDS: Record<Emotion, string> = {
  calm: 'settled', neutral: 'steady', happy: 'warm', sad: 'heavy',
  angry: 'tense', fearful: 'uneasy', disgust: 'strained', surprised: 'stirred',
};

export const TONE_COLORS: Record<Emotion, string> = {
  calm: '#00685d', neutral: '#4e5f62', happy: '#b7791f', sad: '#3f5f9a',
  angry: '#ba1a1a', fearful: '#7b4fa0', disgust: '#6b6b2f', surprised: '#c05621',
};

const REFLECTIONS: Record<Emotion, string> = {
  calm: 'Your voice carried a settled, even quality today.',
  neutral: 'I heard a steady, grounded cadence in your voice.',
  happy: 'There was warmth and a gentle lift in your voice.',
  sad: 'Your voice sounded a little heavy today, softer and slower.',
  angry: 'I noticed tension and intensity in how you spoke.',
  fearful: 'Your voice carried some unease, with a quicker, less steady rhythm.',
  disgust: 'I heard some strain in your voice today.',
  surprised: 'Your voice moved with sudden shifts and brightness.',
};

// Mirrors the backend's pick_headline: classes the model recognizes poorly
// only lead when they clearly win.
const UNRELIABLE = new Set<Emotion>(['disgust', 'fearful', 'surprised']);

export interface SessionSummary {
  emotion: Emotion;
  certainty: 'high' | 'low';
  probabilities: Record<Emotion, number>;
  arousal: number;
  voicedSeconds: number;
  transcript: string;
  stress: Trend;
  energy: Trend;
  fatigue: Trend;
}

export function summarize(readings: EmotionReading[]): SessionSummary | null {
  if (!readings.length) return null;
  const finals = readings.filter((r) => r.segment !== 'interim');
  const pool = finals.length ? finals : [readings[readings.length - 1]];
  const weights = pool.map((r) => Math.max(r.voicedSeconds, 0.5));
  const totalW = weights.reduce((a, b) => a + b, 0);

  const probabilities = Object.fromEntries(
    EMOTIONS.map((e) => [e, pool.reduce((acc, r, i) => acc + r.probabilities[e] * weights[i], 0) / totalW]),
  ) as Record<Emotion, number>;
  const arousal = pool.reduce((acc, r, i) => acc + r.prosody.arousal * weights[i], 0) / totalW;
  const valences = pool.filter((r) => r.prosody.valence != null);
  const valence = valences.length
    ? valences.reduce((acc, r) => acc + (r.prosody.valence as number), 0) / valences.length
    : 0.5;

  const ranked = [...EMOTIONS].sort((a, b) => probabilities[b] - probabilities[a]);
  let emotion = ranked[0];
  let demoted = false;
  if (UNRELIABLE.has(emotion) && probabilities[emotion] < 40) {
    const bestReliable = ranked.find((e) => !UNRELIABLE.has(e)) ?? emotion;
    if (probabilities[emotion] - probabilities[bestReliable] < 12) {
      emotion = bestReliable;
      demoted = true;
    }
  }
  const certainty =
    !demoted && probabilities[emotion] >= 40 && pool.some((r) => r.certainty === 'high') ? 'high' : 'low';

  const tenseNegative = emotion === 'angry' || emotion === 'fearful' || emotion === 'disgust';
  const stress: Trend =
    tenseNegative || (arousal > 0.6 && valence < 0.4)
      ? 'Elevated'
      : (emotion === 'calm' || emotion === 'neutral' || emotion === 'happy') && arousal < 0.55
      ? 'Improving'
      : 'Stable';
  const energy: Trend = arousal < 0.3 ? 'Rest needed' : arousal > 0.65 ? 'Elevated' : 'Stable';
  const fatigue: Trend = emotion === 'sad' || arousal < 0.25 ? 'Rest needed' : 'Stable';

  return {
    emotion,
    certainty,
    probabilities,
    arousal,
    voicedSeconds: pool.reduce((acc, r) => acc + r.voicedSeconds, 0),
    transcript: finals.map((r) => r.transcript).filter(Boolean).join(' '),
    stress,
    energy,
    fatigue,
  };
}

export function reflectionFor(s: SessionSummary): string {
  const energyLine =
    s.arousal < 0.3
      ? 'Your energy seemed low - rest is a valid choice today.'
      : s.arousal > 0.65
      ? 'There was a lot of energy moving through your voice.'
      : 'Your energy sounded fairly even.';
  const hedge = s.certainty === 'low' ? ' This is a soft read rather than a certainty.' : '';
  return `${REFLECTIONS[s.emotion]} ${energyLine}${hedge}`;
}

export const METRIC_COPY: Record<'stress' | 'energy' | 'fatigue', Partial<Record<Trend, string>>> = {
  stress: {
    Elevated: "Some tension in today's voice check-in",
    Improving: "Voice sounded settled in today's check-in",
    Stable: "Holding steady in today's voice check-in",
  },
  energy: {
    'Rest needed': 'Low vocal energy today - go gently',
    Elevated: 'Heightened vocal energy today',
    Stable: "Energy steady in today's check-in",
  },
  fatigue: {
    'Rest needed': 'Voice suggested tiredness today',
    Stable: 'No strong signs of tiredness today',
  },
};

export const TREND_LABELS: Record<Trend, string> = {
  Improving: 'Calming down',
  Stable: 'Steady',
  'Rest needed': 'Rest needed',
  Elevated: 'Elevated',
};

// Returns whether the trends were updated (only with enough speech to trust).
export function applyMetricUpdates(
  s: SessionSummary,
  onUpdateMetric: (metricId: string, trend: Trend, description?: string) => void,
): boolean {
  if (s.voicedSeconds < MIN_VOICED_FOR_METRICS) return false;
  (['stress', 'energy', 'fatigue'] as const).forEach((id) =>
    onUpdateMetric(id, s[id], METRIC_COPY[id][s[id]]),
  );
  return true;
}
