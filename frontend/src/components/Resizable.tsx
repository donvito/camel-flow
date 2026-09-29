import { useCallback, useRef, useState } from 'react';
import { load, save } from '../storage';

/** A sidebar width that the user can drag, remembered in localStorage. */
export function usePanelWidth(key: string, initial: number, min: number, max: number) {
  const [width, setWidth] = useState(() => clamp(load(key, initial), min, max));
  const latest = useRef(width);
  latest.current = width;

  /** side = which edge the handle sits on: dragging a left-edge handle leftwards makes the panel wider. */
  const startDrag = useCallback(
    (side: 'left' | 'right') => (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = latest.current;
      const maxW = Math.min(max, window.innerWidth * 0.7);
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        setWidth(clamp(side === 'left' ? startW - dx : startW + dx, min, maxW));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.classList.remove('resizing');
        save(key, latest.current);
      };
      document.body.classList.add('resizing');
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [key, min, max],
  );

  const reset = useCallback(() => {
    setWidth(initial);
    save(key, initial);
  }, [key, initial]);

  return { width, startDrag, reset };
}

export function ResizeHandle({ side, onPointerDown, onDoubleClick }: {
  side: 'left' | 'right';
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
}) {
  return (
    <div
      className={`resize-handle ${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Drag to resize"
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    />
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
