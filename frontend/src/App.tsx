import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider, type EdgeTypes, type NodeTypes } from '@xyflow/react';
import { Upload } from 'lucide-react';
import { clearUploads, closeFile, fetchConfig, uploadFile, useGraph } from './api';
import { DetailsPanel, type Selection } from './components/DetailsPanel';
import { AboutDialog, ExportDialog, ShortcutsDialog } from './components/Dialogs';
import { DropZone } from './components/DropZone';
import { Explorer } from './components/Explorer';
import { Legend } from './components/Legend';
import { formatShortcut, MenuBar, type Menu } from './components/MenuBar';
import { ResizeHandle, usePanelWidth } from './components/Resizable';
import { SourceView } from './components/SourceView';
import { Toolbar } from './components/Toolbar';
import { TooltipLayer } from './components/Tooltip';
import { stepsToFlow, type StepNodeData } from './drill/stepsToFlow';
import { JoinNode, OPEN_ROUTE_EVENT, StepGroupNode, StepNodeView } from './drill/StepNodes';
import { LinkEdge } from './edges/LinkEdge';
import type { ExportBackground, ExportOptions } from './export';
import { FlowCanvas, type CanvasApi } from './FlowCanvas';
import { ApiNode } from './nodes/ApiNode';
import { FileGroupNode } from './nodes/FileGroupNode';
import { RouteNode } from './nodes/RouteNode';
import { SystemNodeView } from './nodes/SystemNode';
import { SettingsProvider, useSettings } from './settings';
import { overviewToFlow, searchText } from './toFlow';
import type { Config, Graph, ThemeChoice } from './types';

const overviewNodeTypes: NodeTypes = { route: RouteNode, system: SystemNodeView, api: ApiNode, fileGroup: FileGroupNode };
const drillNodeTypes: NodeTypes = { step: StepNodeView, stepGroup: StepGroupNode, join: JoinNode };
const edgeTypes: EdgeTypes = { link: LinkEdge };

function neighbours(graph: Graph, id: string): Set<string> {
  const s = new Set([id]);
  for (const l of graph.links) {
    if (l.source === id) s.add(l.target);
    if (l.target === id) s.add(l.source);
  }
  return s;
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'diagram';
}

type DialogName = 'export' | 'shortcuts' | 'about' | null;

function Viewer({ config }: { config: Config }) {
  const settings = useSettings();
  const { graph, error, updatedAt, connected, reload } = useGraph();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drillId, setDrillId] = useState<string | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogName>(null);
  const canvasApi = useRef<CanvasApi | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const register = useCallback((api: CanvasApi | null) => {
    canvasApi.current = api;
  }, []);
  const explorerW = usePanelWidth('cwv.w.explorer', 260, 180, 520);
  const detailsW = usePanelWidth('cwv.w.details', 400, 300, 900);

  const flash = useCallback((msg: string, ms = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }, []);

  // Toast on live reload
  useEffect(() => {
    if (updatedAt) flash('Diagram updated from changed files');
  }, [updatedAt, flash]);

  // ---- per-file view
  // A selected file that no longer exists (e.g. dropped files cleared) falls back to all files
  const fileFilter = graph && settings.file && graph.files.some((f) => f.path === settings.file) ? settings.file : null;
  const showFile = useCallback(
    (path: string | null) => {
      settings.setFile(path);
      setSelectedId(null);
      setDrillId(null);
    },
    [settings],
  );

  // ---- overview
  const filters = {
    showSystems: settings.showSystems,
    showInternal: settings.showInternal,
    groupByFile: settings.groupByFile,
    file: fileFilter,
  };
  const overview = useMemo(
    () => (graph ? overviewToFlow(graph, filters) : { nodes: [], edges: [] }),
    [graph, settings.showSystems, settings.showInternal, settings.groupByFile, fileFilter],
  );
  const overviewKey = `${settings.view}|${settings.direction}|${settings.groupByFile}|${settings.showSystems}|${settings.showInternal}|${fileFilter}`;

  // Dropped / opened files are shown on their own once the server has them
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const onUploaded = useCallback((paths: string[]) => setPendingFile(paths[0]), []);
  useEffect(() => {
    if (pendingFile && graph?.files.some((f) => f.path === pendingFile)) {
      showFile(pendingFile);
      setPendingFile(null);
    }
  }, [pendingFile, graph, showFile]);

  const openFiles = useCallback(() => fileInput.current?.click(), []);
  const onFilesChosen = async (files: FileList | null) => {
    const yaml = Array.from(files ?? []).filter((f) => /\.ya?ml$/i.test(f.name));
    const added: string[] = [];
    for (const f of yaml) {
      try {
        await uploadFile(f);
        added.push(`uploaded/${f.name.replace(/[\\/]/g, '_')}`);
      } catch (e) {
        flash(`${f.name}: ${String(e)}`, 5000);
      }
    }
    if (added.length) onUploaded(added);
    if (fileInput.current) fileInput.current.value = '';
  };

  // ---- drill-down
  const drillRoute = graph && drillId ? graph.routes.find((r) => r.id === drillId) ?? null : null;
  const routeByKey = useMemo(() => {
    const m = new Map<string, { id: string; title: string }>();
    for (const r of graph?.routes ?? []) {
      if (r.stepTree?.linkKey) m.set(r.stepTree.linkKey, { id: r.id, title: r.title });
      if (r.template) m.set(`kamelet:${r.routeId}`, { id: r.id, title: r.title });
    }
    return m;
  }, [graph]);
  const drill = useMemo(
    () => (drillRoute ? stepsToFlow(drillRoute, { showInternal: settings.showInternal, routeByKey }) : { nodes: [], edges: [] }),
    [drillRoute, settings.showInternal, routeByKey],
  );
  const drillKey = `${settings.view}|${settings.direction}|${settings.showInternal}|${drillId}`;

  const openRoute = useCallback((id: string) => {
    if (!id.startsWith('route:')) return;
    setDrillId(id);
    setSelectedId(null);
    setSearch('');
  }, []);

  useEffect(() => {
    const on = (e: Event) => openRoute((e as CustomEvent<string>).detail);
    window.addEventListener(OPEN_ROUTE_EVENT, on);
    return () => window.removeEventListener(OPEN_ROUTE_EVENT, on);
  }, [openRoute]);

  const closeOpenedFile = useCallback(
    (path: string) => {
      if (sourcePath === path) setSourcePath(null);
      closeFile(path).catch((e) => flash(String(e), 5000));
    },
    [sourcePath, flash],
  );
  // A source view whose file disappeared (closed or deleted) closes too
  useEffect(() => {
    if (graph && sourcePath && !graph.files.some((f) => f.path === sourcePath)) setSourcePath(null);
  }, [graph, sourcePath]);

  // A route that disappeared (file edited) closes its drill-down
  useEffect(() => {
    if (graph && drillId && !graph.routes.some((r) => r.id === drillId)) setDrillId(null);
  }, [graph, drillId]);

  // ---- selection (canvas clicks close the source view; explorer/source clicks keep it)
  const selectFromCanvas = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setSourcePath(null);
  }, []);
  const selectInFile = useCallback(
    (file: string, id: string) => {
      const switching = fileFilter !== null && fileFilter !== file;
      if (switching) settings.setFile(file);
      setDrillId(null);
      setSelectedId(id);
      // wait for a file switch to lay out before panning to the node
      setTimeout(() => canvasApi.current?.reveal(id), switching ? 450 : 60);
    },
    [fileFilter, settings],
  );
  const viewSource = useCallback((path: string, routeId?: string) => {
    setSourcePath(path);
    if (routeId) setSelectedId(routeId);
  }, []);

  // ---- highlight: search, else neighbours of the selection
  const activeNodes = drillRoute ? drill.nodes : overview.nodes;
  const highlight = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return new Set(activeNodes.filter((n) => searchTextFor(n).includes(q)).map((n) => n.id));
    if (!drillRoute && selectedId && graph) return neighbours(graph, selectedId);
    return null;
  }, [search, activeNodes, drillRoute, selectedId, graph]);

  let selection: Selection | null = null;
  if (graph && selectedId) {
    if (drillRoute) {
      const n = drill.nodes.find((x) => x.id === selectedId);
      const step = (n?.data as StepNodeData | undefined)?.step;
      if (step) selection = { type: 'step', step, route: drillRoute };
    } else if (selectedId.startsWith('route:')) selection = { type: 'route', id: selectedId };
    else if (selectedId.startsWith('sys:')) selection = { type: 'system', id: selectedId };
    else if (selectedId.startsWith('api:')) selection = { type: 'api', id: selectedId };
  }
  const selectedRoute = selectedId?.startsWith('route:') && !drillRoute ? selectedId : null;

  // ---- export
  const doExport = useCallback(
    async (o: Omit<ExportOptions, 'fileName'>) => {
      if (!canvasApi.current) throw new Error('Nothing to export');
      const name = drillRoute ? slug(drillRoute.title) : fileFilter ? slug(fileFilter.replace(/\.ya?ml$/, '')) : 'camel-routes';
      await canvasApi.current.exportPng({ ...o, fileName: `${name}-${settings.view}.png` });
    },
    [drillRoute, fileFilter, settings.view],
  );
  const quickExport = (background: ExportBackground) =>
    doExport({ background, scale: 2 }).catch((e) => flash(String(e), 5000));

  const cycleTheme = () => settings.setTheme(({ system: 'light', light: 'dark', dark: 'system' } as Record<ThemeChoice, ThemeChoice>)[settings.theme]);
  const back = useCallback(() => {
    if (dialog) setDialog(null);
    else if (settings.presentation) settings.setPresentation(false);
    else if (sourcePath) setSourcePath(null);
    else if (selectedId) setSelectedId(null);
    else if (drillId) setDrillId(null);
  }, [dialog, settings, sourcePath, selectedId, drillId]);

  // ---- keyboard shortcuts (single keys are ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        openFiles();
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setDialog('export');
        return;
      }
      if (e.key === 'Escape') {
        if (typing) (t as HTMLElement).blur();
        else back();
        return;
      }
      if (typing || mod || e.altKey || dialog) return;
      switch (e.key) {
        case 'v':
        case 'V':
          settings.setView(settings.view === 'executive' ? 'technical' : 'executive');
          break;
        case 'e':
        case 'E':
          settings.setShowExplorer(!settings.showExplorer);
          break;
        case 'l':
        case 'L':
          settings.setDirection(settings.direction === 'LR' ? 'TB' : 'LR');
          break;
        case 's':
        case 'S':
          settings.setShowSystems(!settings.showSystems);
          break;
        case 'i':
        case 'I':
          settings.setShowInternal(!settings.showInternal);
          break;
        case 'g':
        case 'G':
          if (!drillRoute) settings.setGroupByFile(!settings.groupByFile);
          break;
        case 'm':
        case 'M':
          settings.setShowMinimap(!settings.showMinimap);
          break;
        case 't':
        case 'T':
          cycleTheme();
          break;
        case 'p':
        case 'P':
          settings.setPresentation(!settings.presentation);
          break;
        case '/':
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case '?':
          setDialog('shortcuts');
          break;
        case 'Enter':
          if (selectedRoute) openRoute(selectedRoute);
          break;
        default:
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- menus
  const uploads = graph?.files.some((f) => f.uploaded) ?? false;
  const currentIsOpened = !!fileFilter && !!graph?.files.some((f) => f.path === fileFilter && f.uploaded);
  const menus: Menu[] = [
    {
      label: 'File',
      items: [
        { label: 'Open YAML files…', shortcut: 'Mod+O', onSelect: openFiles },
        { type: 'separator' },
        { label: 'Show all files', checked: fileFilter == null, radio: true, onSelect: () => showFile(null) },
        ...(graph?.files ?? []).slice(0, 20).map((f) => ({
          label: f.uploaded ? `${f.path.replace(/^uploaded\//, '')} (dropped)` : f.path,
          checked: fileFilter === f.path,
          radio: true,
          onSelect: () => showFile(f.path),
        })),
        { type: 'separator' },
        { label: 'View source of this file', disabled: !fileFilter, onSelect: () => fileFilter && viewSource(fileFilter) },
        {
          label: currentIsOpened ? `Close ${fileFilter!.replace(/^uploaded\//, '')}` : 'Close file',
          disabled: !currentIsOpened,
          onSelect: () => fileFilter && closeOpenedFile(fileFilter),
        },
        { label: 'Close all opened files', disabled: !uploads, onSelect: () => clearUploads() },
        { label: 'Reload', onSelect: () => reload() },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Executive', checked: settings.view === 'executive', radio: true, shortcut: 'V', onSelect: () => settings.setView('executive') },
        { label: 'Technical', checked: settings.view === 'technical', radio: true, shortcut: 'V', onSelect: () => settings.setView('technical') },
        { type: 'separator' },
        { label: 'Explorer', checked: settings.showExplorer, shortcut: 'E', onSelect: () => settings.setShowExplorer(!settings.showExplorer) },
        { label: 'Legend', checked: settings.showLegend, onSelect: () => settings.setShowLegend(!settings.showLegend) },
        { label: 'Minimap', checked: settings.showMinimap, shortcut: 'M', onSelect: () => settings.setShowMinimap(!settings.showMinimap) },
        { type: 'separator' },
        { label: 'External systems', checked: settings.showSystems, shortcut: 'S', onSelect: () => settings.setShowSystems(!settings.showSystems) },
        { label: 'Internal steps', checked: settings.showInternal, shortcut: 'I', onSelect: () => settings.setShowInternal(!settings.showInternal) },
        { label: 'Group routes by file', checked: settings.groupByFile, shortcut: 'G', disabled: !!drillRoute, onSelect: () => settings.setGroupByFile(!settings.groupByFile) },
        { type: 'separator' },
        { type: 'header', label: 'Theme' },
        { label: 'System', checked: settings.theme === 'system', radio: true, shortcut: 'T', onSelect: () => settings.setTheme('system') },
        { label: 'Light', checked: settings.theme === 'light', radio: true, onSelect: () => settings.setTheme('light') },
        { label: 'Dark', checked: settings.theme === 'dark', radio: true, onSelect: () => settings.setTheme('dark') },
        { type: 'separator' },
        { label: 'Zoom in', shortcut: '+', onSelect: () => canvasApi.current?.zoomIn() },
        { label: 'Zoom out', shortcut: '−', onSelect: () => canvasApi.current?.zoomOut() },
        { label: 'Fit to screen', shortcut: '0', onSelect: () => canvasApi.current?.fitView() },
        { type: 'separator' },
        { label: 'Presentation mode', shortcut: 'P', onSelect: () => settings.setPresentation(true) },
      ],
    },
    {
      label: 'Layout',
      items: [
        { label: 'Left to right', checked: settings.direction === 'LR', radio: true, shortcut: 'L', onSelect: () => settings.setDirection('LR') },
        { label: 'Top to bottom', checked: settings.direction === 'TB', radio: true, onSelect: () => settings.setDirection('TB') },
        { type: 'separator' },
        { label: 'Reset layout', onSelect: () => canvasApi.current?.resetLayout() },
        { type: 'separator' },
        { label: 'Open selected route step by step', shortcut: 'Enter', disabled: !selectedRoute, onSelect: () => selectedRoute && openRoute(selectedRoute) },
        { label: 'Back to overview', shortcut: 'Esc', disabled: !drillRoute, onSelect: () => setDrillId(null) },
      ],
    },
    {
      label: 'Export',
      items: [
        { label: 'PNG — transparent background', onSelect: () => quickExport('transparent') },
        { label: 'PNG — white background', onSelect: () => quickExport('white') },
        { label: 'PNG — theme background', onSelect: () => quickExport('theme') },
        { type: 'separator' },
        { label: 'Export options…', shortcut: 'Mod+E', onSelect: () => setDialog('export') },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Keyboard shortcuts', shortcut: '?', onSelect: () => setDialog('shortcuts') },
        { label: 'About CamelFlow', onSelect: () => setDialog('about') },
      ],
    },
  ];

  if (error && !graph) {
    return (
      <div className="fatal">
        <h2>Cannot load routes</h2>
        <p className="mono">{error}</p>
        <button className="primary" onClick={reload}>
          Retry
        </button>
      </div>
    );
  }

  const failed = graph?.files.filter((f) => f.error) ?? [];
  const empty = graph && graph.routes.length === 0 && graph.apis.length === 0;
  const scopeBase = graph?.rootDir ?? '';
  const chrome = !settings.presentation;
  const rightPanel = chrome && graph && (sourcePath || selection);

  return (
    <div className={`app ${settings.presentation ? 'presenting' : ''} view-${settings.view} ${empty ? 'is-empty' : ''}`}>
      {chrome && (
        <MenuBar
          menus={menus}
          left={
            <div className="menubar-brand">
              <img src="/favicon.svg" alt="" />
              <span className="menubar-name">CamelFlow</span>
            </div>
          }
          right={
            <div className="menubar-status muted small" title={graph?.rootDir}>
              {graph ? `${graph.routes.length} routes · ${graph.files.length} files` : 'Loading…'}
              {!connected && <span className="offline"> · reconnecting…</span>}
            </div>
          }
        />
      )}
      {chrome && (
        <Toolbar
          ref={searchRef}
          fileFilter={fileFilter}
          drillTitle={drillRoute?.title ?? null}
          onShowAllFiles={() => showFile(null)}
          onBack={() => setDrillId(null)}
          search={search}
          setSearch={setSearch}
          onExport={() => setDialog('export')}
          onReset={() => canvasApi.current?.resetLayout()}
          onFit={() => canvasApi.current?.fitView()}
        />
      )}
      {failed.length > 0 && chrome && (
        <div className="banner error-banner" role="alert">
          <strong>{failed.length === 1 ? '1 file could not be read' : `${failed.length} files could not be read`}:</strong>
          {failed.map((f) => (
            <div key={f.path} className="mono small">
              {f.path} — {f.error?.split('\n').slice(0, 2).map((l) => l.trim()).join(' ')}
            </div>
          ))}
        </div>
      )}
      <div className="workspace">
        {chrome && settings.showExplorer && graph && (
          <div className="side left" style={{ width: explorerW.width }}>
            <Explorer
              graph={graph}
              fileFilter={fileFilter}
              selectedId={selectedId}
              sourcePath={sourcePath}
              onShowFile={showFile}
              onSelectNode={selectInFile}
              onOpenRoute={openRoute}
              onViewSource={(p) => setSourcePath(sourcePath === p ? null : p)}
              onOpenFiles={openFiles}
              onCloseFile={closeOpenedFile}
              onClose={() => settings.setShowExplorer(false)}
            />
            <ResizeHandle side="right" onPointerDown={explorerW.startDrag('right')} onDoubleClick={explorerW.reset} />
          </div>
        )}
        <main className="stage">
          {empty && (
            <div className="empty">
              <div className="empty-card">
                <img src="/favicon.svg" alt="" className="empty-logo" />
                {graph?.rootDir ? (
                  <>
                    <h2>No Camel routes found</h2>
                    <p>
                      Looked in <span className="mono">{graph.rootDir}</span> for <span className="mono">*.yaml</span> /{' '}
                      <span className="mono">*.yml</span> files with Camel routes. Add one there, or open files below.
                    </p>
                  </>
                ) : (
                  <>
                    <h2>Open your Camel routes</h2>
                    <p>Choose Camel YAML DSL files (Kaoto files work too) to see how your routes connect.</p>
                  </>
                )}
                <button className="primary" onClick={openFiles}>
                  <Upload size={15} /> Open YAML files…
                  <kbd className="on-accent">{formatShortcut('Mod+O')}</kbd>
                </button>
                <p className="muted small">or drag them anywhere onto this window</p>
                {!graph?.rootDir && (
                  <p className="muted small">
                    To watch a folder and refresh on every save, start with{' '}
                    <span className="mono">java -jar camelflow.jar ./routes</span>
                  </p>
                )}
              </div>
            </div>
          )}
          {graph && (
            <ReactFlowProvider>
              <FlowCanvas
                scope={`${scopeBase}|overview|${fileFilter ?? '*'}|${settings.view}|${settings.direction}|${settings.groupByFile}`}
                baseNodes={overview.nodes}
                baseEdges={overview.edges}
                nodeTypes={overviewNodeTypes}
                edgeTypes={edgeTypes}
                structureKey={overviewKey}
                grouped={settings.groupByFile}
                active={!drillRoute}
                highlight={drillRoute ? null : highlight}
                selectedId={drillRoute ? null : selectedId}
                onSelect={selectFromCanvas}
                onOpen={openRoute}
                register={register}
                nodesep={settings.groupByFile ? 70 : undefined}
                ranksep={settings.direction === 'LR' ? (settings.view === 'technical' ? 190 : 130) : undefined}
              />
            </ReactFlowProvider>
          )}
          {drillRoute && (
            <ReactFlowProvider key={drillRoute.id}>
              <FlowCanvas
                scope={`${scopeBase}|drill|${drillRoute.id}|${settings.view}|${settings.direction}`}
                baseNodes={drill.nodes}
                baseEdges={drill.edges}
                nodeTypes={drillNodeTypes}
                edgeTypes={edgeTypes}
                structureKey={drillKey}
                grouped
                active
                highlight={highlight}
                selectedId={selectedId}
                onSelect={selectFromCanvas}
                register={register}
                nodesep={28}
                ranksep={60}
              />
            </ReactFlowProvider>
          )}
          {graph && chrome && settings.showLegend && <Legend graph={graph} />}
          {settings.presentation && (
            <button className="exit-presentation" onClick={() => settings.setPresentation(false)}>
              Exit presentation (Esc)
            </button>
          )}
          {toast && (
            <div className="toast" role="status">
              {toast}
            </div>
          )}
        </main>
        {rightPanel && (
          <div className="side right" style={{ width: detailsW.width }}>
            <ResizeHandle side="left" onPointerDown={detailsW.startDrag('left')} onDoubleClick={detailsW.reset} />
            <aside className="details">
              {sourcePath ? (
                <SourceView
                  graph={graph}
                  path={sourcePath}
                  selectedId={selectedId}
                  onShowInCanvas={showFile}
                  onSelectRoute={selectInFile}
                  onClose={() => setSourcePath(null)}
                />
              ) : (
                selection && (
                  <DetailsPanel
                    graph={graph}
                    selection={selection}
                    onClose={() => setSelectedId(null)}
                    onSelect={(id) => setSelectedId(id)}
                    onOpenFlow={openRoute}
                    onViewSource={viewSource}
                  />
                )
              )}
            </aside>
          </div>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".yaml,.yml"
        multiple
        hidden
        onChange={(e) => onFilesChosen(e.target.files)}
      />
      <DropZone onError={(m) => flash(m, 5000)} onUploaded={onUploaded} />
      <TooltipLayer />
      {dialog === 'export' && <ExportDialog onClose={() => setDialog(null)} onExport={doExport} />}
      {dialog === 'shortcuts' && <ShortcutsDialog onClose={() => setDialog(null)} />}
      {dialog === 'about' && <AboutDialog onClose={() => setDialog(null)} version={config.version} rootDir={graph?.rootDir ?? config.rootDir} />}
    </div>
  );
}

function searchTextFor(n: Parameters<typeof searchText>[0]): string {
  if (n.type === 'step') {
    const s = (n.data as StepNodeData).step;
    return [s.label, s.kind, s.uri, s.expression, s.system, s.id].join(' ').toLowerCase();
  }
  return searchText(n);
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch(() => setConfig({ defaultView: 'executive', rootDir: '', version: 'dev' }));
  }, []);
  if (!config) return null;
  return (
    <SettingsProvider defaultView={config.defaultView}>
      <Viewer config={config} />
    </SettingsProvider>
  );
}
