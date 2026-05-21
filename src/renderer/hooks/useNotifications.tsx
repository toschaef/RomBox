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

const DEFAULT_DURATION = 15_000;
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
          const removed = next.shift()!;
          const t = timersRef.current.get(removed.id);
          if (t) clearTimeout(t);
          timersRef.current.delete(removed.id);
        }
        return next;
      });

      scheduleDismiss(id, duration);
    },
    [scheduleDismiss],
  );

  const createBulkCollector = useCallback(
    (operationLabel = 'Operation'): BulkCollector => {
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
              notify(`${operationLabel}: ${successes[0]}`, { type: 'success' });
            } else {
              notify(`${operationLabel} failed: ${failures[0]}`, { type: 'error' });
            }
            return;
          }

          if (failures.length === 0) {
            notify(`${operationLabel}: ${successes.length} items processed successfully`, {
              type: 'success',
            });
          } else if (successes.length === 0) {
            notify(`${operationLabel}: all ${failures.length} items failed`, {
              type: 'error',
            });
          } else {
            notify(
              `${operationLabel}: ${successes.length} succeeded`,
              { type: 'success' },
            );
            notify(
              `${operationLabel}: ${failures.length} failed`,
              { type: 'error' },
            );
          }
        },
      };
    },
    [notify],
  );

  return (
    <NotificationContext.Provider
      value={{ notifications, loadingMessage, setLoadingMessage, notify, createBulkCollector, dismiss }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  return ctx;
}
