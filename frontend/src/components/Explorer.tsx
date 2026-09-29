import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CircleAlert, Code, FileCode2, Folder, Layers, PanelLeftClose, Upload, Webhook, Workflow, X } from 'lucide-react';
import { useSettings } from '../settings';
import type { Graph } from '../types';

interface FolderNode {
  name: string;
  path: string;
  folders: FolderNode[];
  files: string[];
}

function buildTree(paths: string[]): FolderNode {
  const root: FolderNode = { name: '', path: '', folders: [], files: [] };
  for (const p of paths) {
    const parts = p.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join('/');
      let next = node.folders.find((f) => f.path === folderPath);
      if (!next) {
        next = { name: parts[i] === 'uploaded' && i === 0 ? 'Dropped files' : parts[i], path: folderPath, folders: [], files: [] };
        node.folders.push(next);
      }
      node = next;
    }
    node.files.push(p);
  }
  return root;
}

function baseName(p: string) {
  return p.slice(p.lastIndexOf('/') + 1);
}

/**
 * Left sidebar: the YAML files the viewer found (and dropped files), each expandable to its routes
 * and REST endpoints. Clicking a file shows it on the canvas; the code button opens its source.
 */
export function Explorer(props: {
  graph: Graph;
  fileFilter: string | null;
  selectedId: string | null;
  sourcePath: string | null;
  onShowFile: (path: string | null) => void;
  onSelectNode: (file: string, id: string) => void;
  onOpenRoute: (id: string) => void;
  onViewSource: (path: string) => void;
  onOpenFiles: () => void;
  onCloseFile: (path: string) => void;
  onClose: () => void;
}) {
  const { view } = useSettings();
  const { graph } = props;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(props.fileFilter ? [props.fileFilter] : []));
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // Reveal the file currently shown on the canvas
  useEffect(() => {
    if (props.fileFilter) setExpanded((s) => (s.has(props.fileFilter!) ? s : new Set(s).add(props.fileFilter!)));
  }, [props.fileFilter]);

  const tree = useMemo(() => buildTree(graph.files.map((f) => f.path)), [graph.files]);
  const byFile = useMemo(() => {
    const m = new Map<string, { id: string; label: string; sub?: string; kind: 'route' | 'api'; method?: string }[]>();
    for (const a of graph.apis) {
      const list = m.get(a.file) ?? [];
      list.push({ id: a.id, label: a.path, kind: 'api', method: a.method, sub: a.description });
      m.set(a.file, list);
    }
    for (const r of graph.routes) {
      const list = m.get(r.file) ?? [];
      list.push({ id: r.id, label: r.title, sub: r.routeId, kind: 'route' });
      m.set(r.file, list);
    }
    return m;
  }, [graph]);
  const fileInfo = useMemo(() => new Map(graph.files.map((f) => [f.path, f])), [graph.files]);
  const rootName = graph.rootDir ? baseName(graph.rootDir.replace(/\/$/, '')) || graph.rootDir : 'No folder · opened files';

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const renderFile = (path: string, depth: number) => {
    const info = fileInfo.get(path);
    const items = byFile.get(path) ?? [];
    const isOpen = expanded.has(path);
    const active = props.fileFilter === path;
    return (
      <div key={path}>
        <div
          className={`tree-row file ${active ? 'active' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => props.onShowFile(path)}
          title={path}
        >
          <button
            className="tree-twisty"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(toggle(expanded, path));
            }}
            aria-label={isOpen ? 'Collapse' : 'Expand'}
            disabled={items.length === 0}
          >
            {items.length > 0 ? isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}
          </button>
          {info?.error ? <CircleAlert size={14} className="tree-icon error" /> : <FileCode2 size={14} className="tree-icon" />}
          <span className="tree-label">{baseName(path)}</span>
          {!info?.error && <span className="tree-count">{info?.routes ?? 0}</span>}
          <button
            className={`tree-action ${props.sourcePath === path ? 'on' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              props.onViewSource(path);
            }}
            title="View YAML source"
            aria-label="View YAML source"
          >
            <Code size={13} />
          </button>
          {info?.uploaded && (
            <button
              className="tree-action close-file"
              onClick={(e) => {
                e.stopPropagation();
                props.onCloseFile(path);
              }}
              title="Close file"
              aria-label={`Close ${baseName(path)}`}
            >
              <X size={13} />
            </button>
          )}
        </div>
        {isOpen &&
          items.map((it) => (
            <div
              key={it.id}
              className={`tree-row item ${props.selectedId === it.id ? 'active' : ''}`}
              style={{ paddingLeft: 30 + depth * 14 }}
              onClick={() => props.onSelectNode(path, it.id)}
              onDoubleClick={() => it.kind === 'route' && props.onOpenRoute(it.id)}
              title={it.label}
            >
              {it.kind === 'route' ? <Workflow size={13} className="tree-icon" /> : <Webhook size={13} className="tree-icon api" />}
              {it.method && <span className={`method m-${it.method.toLowerCase()}`}>{it.method}</span>}
              <span className="tree-label">
                {it.label}
                {view === 'technical' && it.kind === 'route' && it.sub && it.sub !== it.label && (
                  <span className="mono muted tree-sub"> {it.sub}</span>
                )}
              </span>
            </div>
          ))}
      </div>
    );
  };

  const renderFolder = (folder: FolderNode, depth: number): React.ReactNode => {
    const closed = collapsedFolders.has(folder.path);
    return (
      <div key={folder.path}>
        <div className="tree-row folder" style={{ paddingLeft: 8 + depth * 14 }} onClick={() => setCollapsedFolders(toggle(collapsedFolders, folder.path))}>
          <span className="tree-twisty">{closed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</span>
          <Folder size={14} className="tree-icon" />
          <span className="tree-label">{folder.name}</span>
        </div>
        {!closed && (
          <>
            {folder.folders.map((f) => renderFolder(f, depth + 1))}
            {folder.files.map((f) => renderFile(f, depth + 1))}
          </>
        )}
      </div>
    );
  };

  return (
    <aside className="explorer" aria-label="Files">
      <div className="panel-bar">
        <span className="panel-bar-title">Explorer</span>
        <button className="icon-btn" onClick={props.onOpenFiles} title="Open YAML files…" aria-label="Open YAML files">
          <Upload size={14} />
        </button>
        <button className="icon-btn" onClick={props.onClose} title="Hide explorer (E)" aria-label="Hide explorer">
          <PanelLeftClose size={14} />
        </button>
      </div>
      <div className="tree" role="tree">
        <div className="tree-root muted small" title={graph.rootDir || 'Started without a folder'}>
          {rootName}
        </div>
        <div className={`tree-row all ${props.fileFilter == null ? 'active' : ''}`} onClick={() => props.onShowFile(null)}>
          <span className="tree-twisty" />
          <Layers size={14} className="tree-icon" />
          <span className="tree-label">All files</span>
          <span className="tree-count">{graph.routes.length + graph.apis.length}</span>
        </div>
        {tree.folders.filter((f) => f.path !== 'uploaded').map((f) => renderFolder(f, 0))}
        {tree.files.map((f) => renderFile(f, 0))}
        {tree.folders.filter((f) => f.path === 'uploaded').map((f) => renderFolder(f, 0))}
        {graph.files.length === 0 && (
          <div className="muted small tree-empty">
            No files yet.{' '}
            <button className="link-btn small" onClick={props.onOpenFiles}>
              Open YAML files…
            </button>{' '}
            or drop them onto the window.
          </div>
        )}
      </div>
    </aside>
  );
}
