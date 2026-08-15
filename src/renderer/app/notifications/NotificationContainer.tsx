import { useNotifications } from './NotificationProvider';
import type { Notification } from '../../../shared/types';
import { Toast, ToastSlot } from '../../ui';

function DismissIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

function NotificationToast({ n, onDismiss }: { n: Notification; onDismiss: () => void }) {
  return (
    <Toast tone={n.type === 'success' ? 'success' : 'error'} motion={n.exiting ? 'exit' : 'enter'}>
      <div className="flex-1 wrap-break-word">{n.message}</div>

      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 bg-transparent border-none text-fg-muted hover:text-fg-primary cursor-pointer p-0.5 flex items-center justify-center transition-colors duration-fast"
        aria-label="Dismiss notification"
      >
        <DismissIcon />
      </button>
    </Toast>
  );
}

function LoadingToast({ message }: { message: string }) {
  return (
    <Toast tone="loading">
      <svg
        className="animate-spin h-4.5 w-4.5 text-accent-primary shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <div className="flex-1 wrap-break-word">{message}</div>
    </Toast>
  );
}

export default function NotificationContainer() {
  const { notifications, dismiss, loadingMessage } = useNotifications();

  if (notifications.length === 0 && !loadingMessage) return null;

  return (
    <div
      id="notification-container"
      className="fixed bottom-5 right-5 z-toast flex flex-col gap-2 pointer-events-none"
    >
      {notifications.map((n) => (
        <ToastSlot key={n.id} exiting={n.exiting}>
          <NotificationToast n={n} onDismiss={() => dismiss(n.id)} />
        </ToastSlot>
      ))}
      {loadingMessage && <LoadingToast message={loadingMessage} />}
    </div>
  );
}
