import { useEffect, useRef } from 'react';

export function useDismissable<T extends HTMLElement = HTMLElement, P extends HTMLElement = HTMLElement>(
  open: boolean,
  onDismiss: () => void
) {
  const triggerRef = useRef<T | null>(null);
  const panelRef = useRef<P | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      dismissRef.current();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissRef.current();
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { triggerRef, panelRef };
}
