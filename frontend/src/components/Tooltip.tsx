import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatShortcut } from './MenuBar';

/** Elements that get a styled tooltip: explicit data-tip, or buttons with a title. */
const SELECTOR = '[data-tip], button[title], [role="button"][title], .react-flow__controls-button';

/** Nicer labels (and shortcuts) for React Flow's built-in control buttons. */
const CONTROL_LABELS: Record<string, string> = {
  'zoom in': 'Zoom in (+)',
  'zoom out': 'Zoom out (−)',
  'fit view': 'Fit to screen (0)',
  'toggle interactivity': 'Lock / unlock moving cards',
};

const SHOW_DELAY = 400;
/** Moving between tooltipped items within this window shows the next tooltip immediately. */
const QUICK_WINDOW = 500;

interface Tip {
  text: string;
  shortcut?: string;
  rect: DOMRect;
}

/** "Fit to screen (0)" → text "Fit to screen", shortcut "0". */
function parse(raw: string): { text: string; shortcut?: string } {
  const m = /^(.*?)\s*\(([^()]{1,12})\)\s*$/.exec(raw);
  // only short key-like tokens count as shortcuts: "0", "E", "Esc", "Mod+O"
  if (m && /^(?:(?:Mod|Shift|Alt)\+)*(?:[^\s()]{1,3}|Esc|Enter)$/.test(m[2])) {
    return { text: m[1], shortcut: formatShortcut(m[2]) };
  }
  return { text: raw };
}

/** Moves a native title into data-tip so the browser's own tooltip never shows as well. */
function tipText(el: HTMLElement): string | null {
  if (el.classList.contains('react-flow__controls-button')) {
    const label = (el.getAttribute('title') ?? el.getAttribute('aria-label') ?? '').toLowerCase();
    if (el.hasAttribute('title')) el.removeAttribute('title');
    return CONTROL_LABELS[label] ?? el.dataset.tip ?? (label || null);
  }
  const title = el.getAttribute('title');
  if (title) {
    el.dataset.tip = title;
    el.removeAttribute('title');
  }
  return el.dataset.tip || null;
}

/** One global tooltip for the whole app, driven by pointer and keyboard focus. */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: HTMLElement | null = null;
    let visible = false;
    let hiddenAt = 0;

    const find = (t: EventTarget | null) =>
      t instanceof Element ? (t.closest(SELECTOR) as HTMLElement | null) : null;

    const hide = () => {
      clearTimeout(timer);
      if (visible) hiddenAt = Date.now();
      visible = false;
      current = null;
      setTip(null);
    };

    const arm = (el: HTMLElement | null) => {
      if (el === current) return;
      clearTimeout(timer);
      current = el;
      if (!el) {
        if (visible) hiddenAt = Date.now();
        visible = false;
        setTip(null);
        return;
      }
      const text = tipText(el); // converts title immediately, before the native tooltip can appear
      if (!text) return;
      const quick = visible || Date.now() - hiddenAt < QUICK_WINDOW;
      timer = setTimeout(() => {
        if (current !== el || !el.isConnected) return;
        visible = true;
        setTip({ ...parse(tipText(el) ?? text), rect: el.getBoundingClientRect() });
      }, quick ? 0 : SHOW_DELAY);
    };

    const over = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      arm(find(e.target));
    };
    const focus = (e: FocusEvent) => {
      const el = find(e.target);
      if (el && (e.target as HTMLElement).matches(':focus-visible')) arm(el);
    };

    document.addEventListener('pointerover', over);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide, true);
    window.addEventListener('keydown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide, true);
      window.removeEventListener('keydown', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  // Place below the element (above if there is no room), clamped inside the window
  useLayoutEffect(() => {
    if (!tip || !box.current) {
      setPos(null);
      return;
    }
    const b = box.current.getBoundingClientRect();
    const margin = 8;
    const above = tip.rect.bottom + margin + b.height > window.innerHeight - 4;
    const top = above ? tip.rect.top - margin - b.height : tip.rect.bottom + margin;
    const centre = tip.rect.left + tip.rect.width / 2;
    const left = Math.max(6, Math.min(window.innerWidth - b.width - 6, centre - b.width / 2));
    setPos({ left, top, above });
  }, [tip]);

  if (!tip) return null;
  return (
    <div
      ref={box}
      className={`tooltip ${pos?.above ? 'above' : ''}`}
      role="tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
    >
      <span>{tip.text}</span>
      {tip.shortcut && <kbd>{tip.shortcut}</kbd>}
    </div>
  );
}
