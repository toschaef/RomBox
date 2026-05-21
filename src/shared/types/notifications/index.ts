export type NotificationType = 'success' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  /** ms before auto-dismiss */
  duration: number;
  /** timestamp */
  ts: number;
  /** exit animation flag */
  exiting?: boolean;
}

export interface NotifyOptions {
  type?: NotificationType;
  duration?: number;
}

export interface BulkCollector {
  record: (ok: boolean, label: string) => void;
  flush: () => void;
}

export interface NotificationContext {
  notifications: Notification[];
  loadingMessage: string | null;
  /** push single toast */
  notify: (message: string, opts?: NotifyOptions) => void;
  /** set loading message */
  setLoadingMessage: (message: string | null) => void;
  /** create collector for bulk notification */
  createBulkCollector: (operationLabel?: string) => BulkCollector;
  /** dismiss notification by id */
  dismiss: (id: string) => void;
}
