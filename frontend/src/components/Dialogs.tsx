import { useEffect, useState, type ReactNode } from 'react';
import { Download, ExternalLink, X } from 'lucide-react';
import type { ExportBackground, ExportOptions } from '../export';
import { useSettings } from '../settings';
import { formatShortcut } from './MenuBar';

export function Dialog({ title, onClose, children, width = 420 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} style={{ width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h3>{title}</h3>
          <button className="close" onClick={onClose} aria-label="Close" title="Close (Esc)">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ExportDialog({ onClose, onExport }: { onClose: () => void; onExport: (o: Omit<ExportOptions, 'fileName'>) => Promise<void> }) {
  const { resolvedTheme } = useSettings();
  const [background, setBackground] = useState<ExportBackground>('transparent');
  const [scale, setScale] = useState<1 | 2 | 3>(2);
  const [theme, setTheme] = useState<'current' | 'light' | 'dark'>('current');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog title="Export PNG" onClose={onClose}>
      <div className="menu">
        <div className="menu-label">Background</div>
        <div className="seg small">
          {(['transparent', 'theme', 'white'] as const).map((b) => (
            <button key={b} className={background === b ? 'on' : ''} onClick={() => setBackground(b)}>
              {b === 'transparent' ? 'Transparent' : b === 'theme' ? 'Theme' : 'White'}
            </button>
          ))}
        </div>
        <div className="menu-label">Colors</div>
        <div className="seg small">
          {(['current', 'light', 'dark'] as const).map((t) => (
            <button key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>
              {t === 'current' ? `Current (${resolvedTheme})` : t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
        <div className="menu-label">Resolution</div>
        <div className="seg small">
          {([1, 2, 3] as const).map((s) => (
            <button key={s} className={scale === s ? 'on' : ''} onClick={() => setScale(s)}>
              {s}×
            </button>
          ))}
        </div>
        <div className="muted small">The whole diagram is exported, without the grid or controls.</div>
        <div className="dialog-actions">
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onExport({ background, scale, theme: theme === 'current' ? undefined : theme });
                onClose();
              } catch (e) {
                setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download size={14} /> {busy ? 'Rendering…' : 'Download PNG'}
          </button>
        </div>
        {error && <div className="error small">{error}</div>}
      </div>
    </Dialog>
  );
}

export const SHORTCUTS: [string, string][] = [
  ['V', 'Switch Executive / Technical view'],
  ['E', 'Show / hide the file explorer'],
  ['L', 'Switch layout: left → right / top → bottom'],
  ['S', 'Show / hide external systems'],
  ['I', 'Show / hide internal steps'],
  ['G', 'Group routes by file'],
  ['M', 'Show / hide the minimap'],
  ['T', 'Cycle theme: system → light → dark'],
  ['P', 'Presentation mode'],
  ['/', 'Search'],
  ['+  −  0', 'Zoom in, zoom out, fit to screen'],
  ['Enter', 'Open the selected route step by step'],
  ['Esc', 'Close panel, back to overview, leave presentation'],
  ['Mod+O', 'Open YAML files'],
  ['Mod+E', 'Export PNG…'],
  ['?', 'This list'],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} width={460}>
      <table className="shortcuts">
        <tbody>
          {SHORTCUTS.map(([k, d]) => (
            <tr key={k}>
              <td>
                <kbd>{formatShortcut(k)}</kbd>
              </td>
              <td>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Double-click a route to open its steps. Drag cards to arrange them.</p>
    </Dialog>
  );
}

export function AboutDialog({ onClose, version, rootDir }: { onClose: () => void; version: string; rootDir: string }) {
  return (
    <Dialog title="About CamelFlow" onClose={onClose}>
      <p>High-level diagrams of Apache Camel YAML routes, for explaining integrations to everyone.</p>
      <dl className="kv">
        <dt>Author</dt>
        <dd>Melvin Vivas</dd>
        <dt>GitHub</dt>
        <dd>
          <a href="https://github.com/donvito/" target="_blank" rel="noopener noreferrer">
            github.com/donvito <ExternalLink size={11} aria-hidden />
          </a>
        </dd>
        <dt>Website</dt>
        <dd>
          <a href="https://aibackends.com/" target="_blank" rel="noopener noreferrer">
            AI Backends <ExternalLink size={11} aria-hidden />
          </a>
        </dd>
        <dt>Version</dt>
        <dd>{version}</dd>
        <dt>License</dt>
        <dd>Apache License 2.0</dd>
        <dt>Folder</dt>
        <dd className={rootDir ? 'mono' : 'muted'}>{rootDir || 'None (files opened in the browser)'}</dd>
      </dl>
    </Dialog>
  );
}
