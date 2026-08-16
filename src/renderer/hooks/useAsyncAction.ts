import { useCallback, useState } from 'react';
import { useNotifications } from '../app/notifications/NotificationProvider';
import { NOTIFICATION_MESSAGES } from '../../shared/constants';

type Result = { success?: boolean; message?: string; error?: string };

export type RunOptions = {
  /** shown in the global status bar while the action runs */
  status?: string;
  /** toast on success. omit to stay silent. */
  success?: string;
  /** treat a falsy result.success as a thrown error */
  expectSuccess?: boolean;
};

export function useAsyncAction(opts: { setStatus?: (s: string) => void; setLoading?: (b: boolean) => void; onDone?: () => void | Promise<void> } = {}) {
  const { setStatus, setLoading, onDone } = opts;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { notify, durations } = useNotifications();

  const run = useCallback(
    async <T extends Result>(key: string, fn: () => Promise<T>, options: RunOptions = {}) => {
      const { status, success, expectSuccess = true } = options;

      setBusyKey(key);
      setLoading?.(true);
      if (status) setStatus?.(status);

      try {
        const result = await fn();
        if (expectSuccess && result && result.success === false) {
          throw new Error(result.message || result.error || 'Action failed');
        }
        if (success) notify(success, { type: 'success', duration: durations.short });
        return result;
      } catch (err) {
        notify(NOTIFICATION_MESSAGES.ERROR_MESSAGE((err as Error).message), {
          type: 'error',
          duration: durations.long,
        });
        return undefined;
      } finally {
        setBusyKey(null);
        setLoading?.(false);
        await onDone?.();
      }
    },
    [notify, durations, setStatus, setLoading, onDone]
  );

  return { run, busyKey, busy: busyKey !== null };
}
