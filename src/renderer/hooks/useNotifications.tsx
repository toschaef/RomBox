import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type {
  Notification,
  NotifyOptions,
  BulkCollector,
  NotificationContext,
} from '../../shared/types';

const NotificationContext = createContext<NotificationContext | null>(null);

let _nextId = 0;
const uid = () => `notif-${++_nextId}-${Date.now()}`;

const DURATIONS = {
  short: 3000,
  medium: 6000,
  long: 10000,
};

const DEFAULT_DURATION = DURATIONS.medium;
const MAX_VISIBLE = 6;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const scheduleDismiss = useCallback((id: string, duration: number) => {
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, exiting: true } : n)),
      );
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        timersRef.current.delete(id);
      }, 350);
    }, duration);
    timersRef.current.set(id, timer);
  }, []);

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, exiting: true } : n)),
    );
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 350);
  }, []);

  const notify = useCallback(
    (message: string, opts?: NotifyOptions) => {
      const id = uid();
      const type = opts?.type ?? 'success';
      const duration = opts?.duration ?? DEFAULT_DURATION;

      const n: Notification = { id, type, message, duration, ts: Date.now() };

      setNotifications((prev) => {
        const next = [...prev, n];
        if (next.length > MAX_VISIBLE) {
          const removed = next.shift();
          if (removed) {
            const t = timersRef.current.get(removed.id);
            if (t) clearTimeout(t);
            timersRef.current.delete(removed.id);
          }
        }
        return next;
      });

      scheduleDismiss(id, duration);
    },
    [scheduleDismiss],
  );

  const createBulkCollector = useCallback(
    (): BulkCollector => {
      const successes: string[] = [];
      const failures: string[] = [];

      return {
        record(ok, label) {
          if (ok) successes.push(label);
          else failures.push(label);
        },
        flush() {
          const total = successes.length + failures.length;
          if (total === 0) return;

          if (total === 1) {
            if (successes.length === 1) {
              notify(`${successes[0]} succeeded`, { type: 'success', duration: DURATIONS.medium });
            } else {
              notify(`${failures[0]} failed`, { type: 'error', duration: DURATIONS.medium });
            }
            return;
          }

          if (failures.length === 0) {
            notify(`${successes.length} items processed`, {
              type: 'success',
              duration: DURATIONS.long,
            });
          } else if (successes.length === 0) {
            notify(`${failures.length} items failed`, {
              type: 'error',
              duration: DURATIONS.long,
            });
          } else {
            notify(
              `${successes.length} succeeded`,
              { type: 'success', duration: DURATIONS.long },
            );
            notify(
              `${failures.length} failed`,
              { type: 'error', duration: DURATIONS.long },
            );
          }
        },
      };
    },
    [notify],
  );

  const durations = DURATIONS;

  return (
    <NotificationContext.Provider
      value={{ notifications, loadingMessage, setLoadingMessage, notify, createBulkCollector, dismiss, durations }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  return ctx as NotificationContext;
}
