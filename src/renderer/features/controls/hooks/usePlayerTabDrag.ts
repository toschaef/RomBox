import { useRef, useState } from 'react';

export function usePlayerTabDrag(opts: {
  onReorder: (sourceIndex: number, targetIndex: number) => void;
  onSelect: (index: number) => void;
}) {
  const { onReorder, onSelect } = opts;

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabWidthRef = useRef(0);

  const neighborOffset = (i: number): number => {
    if (dragIndex === null || dragOverIndex === null || i === dragIndex) return 0;
    const width = tabWidthRef.current;
    if (dragIndex < dragOverIndex && i > dragIndex && i <= dragOverIndex) return -width;
    if (dragIndex > dragOverIndex && i >= dragOverIndex && i < dragIndex) return width;
    return 0;
  };

  const onPointerDown = (idx: number) => (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const target = e.currentTarget;
    const container = containerRef.current;
    if (!container) return;

    const startX = e.clientX;
    const originalRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const minOffset = containerRect.left - originalRect.left;
    const maxOffset = containerRect.right - originalRect.right;
    tabWidthRef.current = originalRect.width;

    const slotRects = tabRefs.current.map((el) => (el ? el.getBoundingClientRect() : null));

    let hoverIndex = idx;
    let moved = false;

    target.setPointerCapture(e.pointerId);
    setDragIndex(idx);
    setDragOverIndex(idx);

    const handleMove = (ev: PointerEvent): void => {
      const raw = ev.clientX - startX;
      if (Math.abs(raw) > 4) moved = true;
      setDragOffsetX(Math.min(maxOffset, Math.max(minOffset, raw)));

      let next = idx;
      slotRects.forEach((r, i) => {
        if (!r) return;
        if (ev.clientX >= r.left && ev.clientX <= r.right) next = i;
      });
      hoverIndex = next;
      setDragOverIndex(next);
    };

    const handleUp = (): void => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      target.releasePointerCapture(e.pointerId);

      setDragIndex(null);
      setDragOverIndex(null);
      setDragOffsetX(0);

      if (!moved) onSelect(idx);
      else onReorder(idx, hoverIndex);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const tabProps = (idx: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      tabRefs.current[idx] = el;
    },
    onPointerDown: onPointerDown(idx),
    style:
      dragIndex === idx
        ? { transform: `translateX(${dragOffsetX}px)`, transition: 'none', zIndex: 10 }
        : { transform: `translateX(${neighborOffset(idx)}px)` },
    'data-dragging': dragIndex === idx || undefined,
  });

  return { containerRef, tabProps, dragIndex };
}
