import type { Consent } from '../../lib/api';

// What each consent means, in plain words (sign-up and Privacy share these).
// data_storage is the only one an account needs; the rest are the person's
// choice, and can change any time.

export interface ConsentOption {
  key: keyof Consent;
  title: string;
  /** Said when choosing, at sign-up. */
  hint: string;
  /** Said when changing it later, in Privacy. */
  later: string;
  required?: boolean;
}

export const CONSENT_OPTIONS: ConsentOption[] = [
  {
    key: 'data_storage',
    title: 'Save my check-ins',
    hint: 'So your counsellor can notice when things get harder. An account needs this.',
    later: 'An account needs this. To stop it, delete your data below.',
    required: true,
  },
  {
    key: 'voice_analysis',
    title: 'Notice how my voice sounds',
    hint: 'Only the tone, to understand how you’re feeling. Not your words.',
    later: 'When off, voice check-ins still work, but nothing about them is saved.',
  },
  {
    key: 'store_messages',
    title: 'Keep what I write in chats',
    hint: 'Off unless you choose it. Kept encrypted, so chat picks up where you left off.',
    later: 'Kept encrypted. When off, only a sense of how you were feeling is saved, not your words - and turning it off erases what was kept.',
  },
  {
    key: 'store_recordings',
    title: 'Keep recordings of my voice check-ins',
    hint: 'Off unless you choose it. Only you and your counsellor can play them.',
    later: 'Only you and your counsellor can play them.',
  },
  {
    key: 'share_insights',
    title: 'Let SAHAAS tell my counsellor how I’m doing',
    hint: 'A short summary of feelings and problems after a conversation - never your exact words.',
    later: 'After a conversation, a short summary goes to your counsellor - never your exact words.',
  },
  {
    key: 'ivrs_calls',
    title: 'Call me if I miss a check-in',
    hint: 'A short automated call. You can move it a couple of times. Needs a phone number.',
    later: 'A short automated call between 9am and 8pm. You can move it twice. Needs your phone number.',
  },
];

export const DEFAULT_CONSENT: Consent = {
  data_storage: true,
  voice_analysis: true,
  store_messages: false,
  store_recordings: false,
  share_insights: true,
  ivrs_calls: false,
};

/** share_insights is on unless switched off, including for older accounts. */
export const consentOn = (consent: Partial<Consent>, key: keyof Consent) =>
  key === 'share_insights' ? consent.share_insights !== false : !!consent[key];
