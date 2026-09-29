import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { load, save } from './storage';
import type { Direction, ThemeChoice, ViewMode } from './types';

/** Viewer-wide display settings. View mode resolves as URL (?view=) › localStorage › server default. */
export interface Settings {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
  resolvedTheme: 'light' | 'dark';
  direction: Direction;
  setDirection: (d: Direction) => void;
  showSystems: boolean;
  setShowSystems: (b: boolean) => void;
  showInternal: boolean;
  setShowInternal: (b: boolean) => void;
  groupByFile: boolean;
  setGroupByFile: (b: boolean) => void;
  showMinimap: boolean;
  setShowMinimap: (b: boolean) => void;
  presentation: boolean;
  setPresentation: (b: boolean) => void;
  showExplorer: boolean;
  setShowExplorer: (b: boolean) => void;
  showLegend: boolean;
  setShowLegend: (b: boolean) => void;
  /** Selected file for the per-file view; null = all files. */
  file: string | null;
  setFile: (f: string | null) => void;
}

const SettingsContext = createContext<Settings | null>(null);

export function useSettings(): Settings {
  const s = useContext(SettingsContext);
  if (!s) throw new Error('SettingsProvider missing');
  return s;
}

function urlView(): ViewMode | null {
  const v = new URLSearchParams(window.location.search).get('view');
  return v === 'technical' || v === 'executive' ? v : null;
}

function usePersisted<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  return [
    value,
    (v: T) => {
      setValue(v);
      save(key, v);
    },
  ];
}

function useSystemDark(): boolean {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark;
}

export function SettingsProvider({ defaultView, children }: { defaultView: ViewMode; children: ReactNode }) {
  const [view, setViewState] = useState<ViewMode>(() => urlView() ?? load<ViewMode | null>('cwv.view', null) ?? defaultView);
  const [theme, setTheme] = usePersisted<ThemeChoice>('cwv.theme', 'system');
  const [direction, setDirection] = usePersisted<Direction>('cwv.direction', 'LR');
  const [showSystems, setShowSystems] = usePersisted('cwv.showSystems', true);
  const [internalOverride, setInternalOverride] = useState<boolean | null>(null);
  const [groupByFile, setGroupByFile] = usePersisted('cwv.groupByFile', false);
  const [showMinimap, setShowMinimap] = usePersisted('cwv.minimap', true);
  const [presentation, setPresentation] = useState(false);
  const [showExplorer, setShowExplorer] = usePersisted('cwv.explorer', true);
  const [showLegend, setShowLegend] = usePersisted('cwv.legend', true);
  const [file, setFileState] = useState<string | null>(() => new URLSearchParams(window.location.search).get('file'));
  const systemDark = useSystemDark();
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const value = useMemo<Settings>(
    () => ({
      view,
      setView: (v) => {
        setViewState(v);
        save('cwv.view', v);
        setInternalOverride(null); // "show internal steps" follows the view again
        const url = new URL(window.location.href);
        if (url.searchParams.has('view')) {
          url.searchParams.set('view', v);
          window.history.replaceState(null, '', url);
        }
      },
      theme,
      setTheme,
      resolvedTheme,
      direction,
      setDirection,
      showSystems,
      setShowSystems,
      showInternal: internalOverride ?? view === 'technical',
      setShowInternal: setInternalOverride,
      groupByFile,
      setGroupByFile,
      showMinimap,
      setShowMinimap,
      presentation,
      setPresentation,
      showExplorer,
      setShowExplorer,
      showLegend,
      setShowLegend,
      file,
      setFile: (f) => {
        setFileState(f);
        const url = new URL(window.location.href);
        if (f) url.searchParams.set('file', f);
        else url.searchParams.delete('file');
        window.history.replaceState(null, '', url);
      },
    }),
    [view, theme, resolvedTheme, direction, showSystems, internalOverride, groupByFile, showMinimap, presentation, file, showExplorer, showLegend],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
