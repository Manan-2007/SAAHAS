import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';

export type Remote<T> =
  | { status: 'idle' }
  | { status: 'loading'; data?: T }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string; offline: boolean; data?: T };

/**
 * One backend read with loading / ready / error states, cancelled on unmount.
 * `enabled: false` (a guest, say) leaves it idle: nothing is fetched, and the
 * screen shows its no-account state instead of an error.
 */
export function useRemote<T>(load: () => Promise<T>, deps: unknown[], enabled = true) {
  const [state, setState] = useState<Remote<T>>(enabled ? { status: 'loading' } : { status: 'idle' });
  const loadRef = useRef(load);
  loadRef.current = load;
  const seq = useRef(0);

  const reload = useCallback(() => {
    if (!enabled) {
      setState({ status: 'idle' });
      return;
    }
    const id = ++seq.current;
    setState((s) => ({ status: 'loading', data: 'data' in s ? s.data : undefined }));
    loadRef
      .current()
      .then((data) => {
        if (id === seq.current) setState({ status: 'ready', data });
      })
      .catch((err: unknown) => {
        if (id !== seq.current) return;
        const offline = !(err instanceof ApiError);
        setState((s) => ({
          status: 'error',
          offline,
          message: err instanceof ApiError ? err.message : 'We couldn’t reach SAHAAS right now.',
          data: 'data' in s ? s.data : undefined,
        }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    reload();
    return () => {
      seq.current++;
    };
  }, [reload]);

  /** Swap in a local change (an answered question, say) without a refetch. */
  const mutate = useCallback((update: (data: T) => T) => {
    setState((s) => (s.status === 'ready' ? { status: 'ready', data: update(s.data) } : s));
  }, []);

  const data = 'data' in state ? state.data : undefined;
  return { state, data, reload, mutate };
}
