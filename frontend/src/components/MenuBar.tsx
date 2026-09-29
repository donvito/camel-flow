import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';

export type MenuItem =
  | { type: 'separator' }
  | { type: 'header'; label: string }
  | {
      type?: 'item';
      label: string;
      shortcut?: string;
      checked?: boolean;
      /** radio items show a dot instead of a check */
      radio?: boolean;
      disabled?: boolean;
      icon?: ReactNode;
      onSelect: () => void;
    };

export interface Menu {
  label: string;
  items: MenuItem[];
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Formats "Mod+O" as ⌘O on macOS and Ctrl+O elsewhere. */
export function formatShortcut(s: string): string {
  if (!isMac) return s.replace('Mod', 'Ctrl');
  return s.replace('Mod+', '⌘').replace('Shift+', '⇧').replace('Alt+', '⌥');
}

/**
 * Desktop-style menu bar: click a title to open, hover to move between open menus,
 * arrow keys / Enter to navigate, Esc or a click outside to close.
 */
export function MenuBar({ menus, left, right }: { menus: Menu[]; left?: ReactNode; right?: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  const [active, setActive] = useState<number>(-1);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open == null) return;
    const outside = (e: MouseEvent) => {
      if (bar.current && !bar.current.contains(e.target as globalThis.Node)) setOpen(null);
    };
    const keys = (e: KeyboardEvent) => {
      const items = menus[open].items;
      const selectable = items.map((it, i) => ((it.type ?? 'item') === 'item' && !(it as { disabled?: boolean }).disabled ? i : -1)).filter((i) => i >= 0);
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(null);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const pos = selectable.indexOf(active);
        const next = e.key === 'ArrowDown' ? (pos + 1) % selectable.length : (pos - 1 + selectable.length) % selectable.length;
        setActive(selectable[next] ?? -1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setOpen((open + (e.key === 'ArrowRight' ? 1 : menus.length - 1)) % menus.length);
        setActive(-1);
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault();
        const it = items[active];
        if ((it.type ?? 'item') === 'item') {
          setOpen(null);
          (it as { onSelect: () => void }).onSelect();
        }
      }
    };
    window.addEventListener('mousedown', outside);
    window.addEventListener('keydown', keys, true);
    return () => {
      window.removeEventListener('mousedown', outside);
      window.removeEventListener('keydown', keys, true);
    };
  }, [open, active, menus]);

  return (
    <div className="menubar" ref={bar} role="menubar">
      {left}
      {menus.map((m, i) => (
        <div key={m.label} className="menubar-menu">
          <button
            className={`menubar-title ${open === i ? 'open' : ''}`}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === i}
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(open === i ? null : i);
              setActive(-1);
            }}
            onMouseEnter={() => {
              if (open != null && open !== i) {
                setOpen(i);
                setActive(-1);
              }
            }}
          >
            {m.label}
          </button>
          {open === i && (
            <div className="menu-dropdown" role="menu" aria-label={m.label}>
              {m.items.map((it, j) => {
                if (it.type === 'separator') return <div key={j} className="menu-sep" role="separator" />;
                if (it.type === 'header') return <div key={j} className="menu-header">{it.label}</div>;
                return (
                  <button
                    key={j}
                    role={it.checked != null ? (it.radio ? 'menuitemradio' : 'menuitemcheckbox') : 'menuitem'}
                    aria-checked={it.checked}
                    className={`menu-item ${active === j ? 'active' : ''}`}
                    disabled={it.disabled}
                    onMouseEnter={() => setActive(j)}
                    onClick={() => {
                      setOpen(null);
                      it.onSelect();
                    }}
                  >
                    <span className="menu-check">
                      {it.checked ? it.radio ? <span className="radio-dot" /> : <Check size={13} /> : it.icon}
                    </span>
                    <span className="menu-label-text">{it.label}</span>
                    {it.shortcut && <span className="menu-shortcut">{formatShortcut(it.shortcut)}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <div className="menubar-spacer" />
      {right}
    </div>
  );
}
