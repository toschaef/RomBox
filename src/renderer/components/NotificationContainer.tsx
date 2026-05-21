import { useNotifications } from '../hooks/useNotifications';
import type { Notification } from '../../shared/types';



function DismissIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

function Toast({ n, onDismiss }: { n: Notification; onDismiss: () => void }) {
  const isSuccess = n.type === 'success';

  return (
    <div
      className={`
        notification-toast
        ${n.exiting ? 'notification-exit' : 'notification-enter'}
        flex items-center gap-2.5 px-3.5 py-3
        min-w-70 max-w-100
        ${isSuccess
          ? 'border border-green-900 bg-linear-to-br from-green-900/25 to-bg-primary/95'
          : 'border border-red-900 bg-linear-to-br from-red-900/25 to-bg-primary/95'
        }
        backdrop-blur-xl
        text-fg-primary text-[13px] font-semibold leading-snug
        pointer-events-auto relative overflow-hidden
      `}
    >
      {/* type indicator line */}
      <div
        className={`
          absolute left-0 top-0 bottom-0 w-0.75
          ${isSuccess ? 'bg-green-500' : 'bg-red-500'}
        `}
      />

      {/* message */}
      <div className="flex-1 wrap-break-word">
        {n.message}
      </div>

      {/* dismiss */}
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 bg-transparent border-none text-fg-muted hover:text-fg-primary cursor-pointer p-0.5 flex items-center justify-center transition-colors duration-150"
        aria-label="Dismiss notification"
      >
        <DismissIcon />
      </button>
    </div>
  );
}

function LoadingToast({ message }: { message: string }) {
  return (
    <div
      className={`
        notification-toast notification-enter
        flex items-center gap-2.5 px-3.5 py-3
        min-w-70 max-w-100
        border border-accent-primary bg-linear-to-br from-accent-primary/25 to-bg-primary/95
        backdrop-blur-xl
        text-fg-primary text-[13px] font-semibold leading-snug
        pointer-events-auto relative overflow-hidden
      `}
    >
      <div className="absolute left-0 top-0 bottom-0 w-0.75 bg-accent-primary" />
      <svg className="animate-spin h-4.5 w-4.5 text-accent-primary shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <div className="flex-1 wrap-break-word">
        {message}
      </div>
    </div>
  );
}

export default function NotificationContainer() {
  const { notifications, dismiss, loadingMessage } = useNotifications();

  if (notifications.length === 0 && !loadingMessage) return null;

  return (
    <div
      id="notification-container"
      className="fixed bottom-5 right-5 z-9999 flex flex-col gap-2 pointer-events-none"
    >
      {notifications.map((n) => (
        <Toast key={n.id} n={n} onDismiss={() => dismiss(n.id)} />
      ))}
      {loadingMessage && <LoadingToast message={loadingMessage} />}
    </div>
  );
}
