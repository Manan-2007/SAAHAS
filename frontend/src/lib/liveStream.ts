// Live updates from the backend (server-sent events on /counsellor/stream and
// /me/stream). EventSource can't send the Authorization header, and the token
// must never ride in a URL, so this reads the stream with fetch instead.
//
// Reconnects on its own with backoff; a 401 ends it (the session is over and
// api.ts already sends the person back to sign-in).

import { authHeaders, expireSession, httpUrl } from './api';

export interface LiveEvent {
  type: string;
  at: number;
  victim_id?: string;
  [field: string]: unknown;
}

export interface LiveHandlers {
  onEvent: (event: LiveEvent) => void;
  onStatus?: (connected: boolean) => void;
}

const MAX_BACKOFF_MS = 15_000;

export function openLiveStream(path: '/counsellor/stream' | '/me/stream', h: LiveHandlers): () => void {
  let closed = false;
  let controller: AbortController | null = null;
  let backoff = 1000;

  const run = async () => {
    while (!closed) {
      controller = new AbortController();
      try {
        const res = await fetch(httpUrl(path), {
          headers: { ...authHeaders(), Accept: 'text/event-stream' },
          signal: controller.signal,
          cache: 'no-store',
        });
        if (res.status === 401) {
          expireSession();
          return;
        }
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        h.onStatus?.(true);
        backoff = 1000;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let cut: number;
          while ((cut = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const data = block
              .split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trim())
              .join('\n');
            if (!data) continue;           // heartbeat comment
            try {
              const event = JSON.parse(data) as LiveEvent;
              if (event.type !== 'ready') h.onEvent(event);
            } catch {
              /* a malformed frame is skipped, not fatal */
            }
          }
        }
      } catch {
        if (closed) return;
      }
      h.onStatus?.(false);
      if (closed) return;
      await new Promise((r) => setTimeout(r, backoff));
      backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
    }
  };
  run();

  return () => {
    closed = true;
    controller?.abort();
  };
}
