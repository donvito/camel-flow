import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function Popover({ button, children, label, title = label }: { button: ReactNode; children: ReactNode; label: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    // Keep the panel inside the viewport when the toolbar wraps or the window shrinks.
    const place = () => {
      if (!trigger.current || !panel.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const width = panel.current.getBoundingClientRect().width;
      const left = Math.max(14, Math.min(anchor.right - width, window.innerWidth - width - 14));
      Object.assign(panel.current.style, {
        position: 'fixed',
        left: `${left}px`,
        right: 'auto',
        top: `${anchor.bottom + 6}px`,
        maxHeight: `${Math.max(0, window.innerHeight - anchor.bottom - 20)}px`,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    const focus = (e: FocusEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close, true);
    window.addEventListener('keydown', esc, true);
    window.addEventListener('focusin', focus);
    return () => {
      window.removeEventListener('mousedown', close, true);
      window.removeEventListener('keydown', esc, true);
      window.removeEventListener('focusin', focus);
    };
  }, [open]);
  return (
    <div className="popover-wrap" ref={ref}>
      <button ref={trigger} className={`tb-btn ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} title={title} aria-label={label} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? id : undefined}>
        {button}
      </button>
      {open && (
        <div ref={panel} id={id} className="popover" role="dialog" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  );
}
