// Fan-out of the counsellor's live stream inside the Command Centre. AdminApp
// holds the one connection (/counsellor/stream); any view can listen.

import { useEffect, useRef } from 'react';
import type { LiveEvent } from '../lib/liveStream';
import { TONE } from './palette';

const bus = new EventTarget();

export function emitLive(event: LiveEvent) {
  bus.dispatchEvent(new CustomEvent('live', { detail: event }));
}

/** Calls handler for every live event (optionally only some types). */
export function useLiveEvents(handler: (event: LiveEvent) => void, types?: string[]) {
  const ref = useRef(handler);
  ref.current = handler;
  const key = types?.join(',') ?? '';
  useEffect(() => {
    const wanted = key ? new Set(key.split(',')) : null;
    const listener = (e: Event) => {
      const event = (e as CustomEvent<LiveEvent>).detail;
      if (!wanted || wanted.has(event.type)) ref.current(event);
    };
    bus.addEventListener('live', listener);
    return () => bus.removeEventListener('live', listener);
  }, [key]);
}

export const LEVEL_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  none: { label: 'Calm', ...TONE.neutral },
  low: { label: 'Low', ...TONE.low },
  moderate: { label: 'Moderate', ...TONE.warn },
  high: { label: 'High', ...TONE.danger },
};

export const CHANNEL_LABEL: Record<string, { label: string; icon: string }> = {
  chat: { label: 'Chat', icon: 'chat' },
  voice_call: { label: 'Voice call', icon: 'call' },
  voice_checkin: { label: 'Voice check-in', icon: 'mic' },
  voice_note: { label: 'Voice note', icon: 'graphic_eq' },
  message: { label: 'Message to you', icon: 'mail' },
  ivrs: { label: 'Phone check-in', icon: 'phone_in_talk' },
};

export const timeShort = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
