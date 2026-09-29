import { useEffect, useMemo, useState } from 'react';
import { Copy, FileCode2, Layers, WrapText, X } from 'lucide-react';
import type { Graph } from '../types';
import { YamlSnippet, type LineRange } from './YamlSnippet';

/** Full YAML of one file, in the right panel. Clicking a route's lines shows that route on the canvas. */
export function SourceView(props: {
  graph: Graph;
  path: string;
  selectedId: string | null;
  onShowInCanvas: (path: string) => void;
  onSelectRoute: (path: string, id: string) => void;
  onClose: () => void;
}) {
  const { graph, path } = props;
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reload when the file changes on disk (graph regenerates on every change)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/source?path=${encodeURIComponent(path)}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => !cancelled && (setText(t), setError(null)))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [path, graph.generatedAt]);

  const ranges = useMemo<LineRange[]>(
    () =>
      graph.routes
        .filter((r) => r.file === path)
        .map((r) => ({ id: r.id, title: r.title, start: r.lines[0], end: r.lines[1] })),
    [graph.routes, path],
  );
  const selected = ranges.find((r) => r.id === props.selectedId);
  const fileError = graph.files.find((f) => f.path === path)?.error;

  return (
    <div className="source-view">
      <div className="panel-bar">
        <FileCode2 size={14} className="muted" />
        <span className="panel-bar-title mono" title={path}>
          {path}
        </span>
        <button className={`icon-btn ${wrap ? 'on' : ''}`} onClick={() => setWrap(!wrap)} title="Wrap long lines" aria-label="Wrap long lines">
          <WrapText size={14} />
        </button>
        <button
          className="icon-btn"
          onClick={async () => {
            if (text == null) return;
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // clipboard unavailable (e.g. insecure context); nothing else to do
            }
          }}
          title={copied ? 'Copied' : 'Copy YAML'}
          aria-label="Copy YAML"
        >
          <Copy size={14} />
        </button>
        <button className="icon-btn" onClick={() => props.onShowInCanvas(path)} title="Show this file on the canvas" aria-label="Show on canvas">
          <Layers size={14} />
        </button>
        <button className="icon-btn" onClick={props.onClose} title="Close (Esc)" aria-label="Close source">
          <X size={14} />
        </button>
      </div>
      {fileError && <div className="source-error small">{fileError}</div>}
      {ranges.length > 0 && <div className="muted small source-hint">Click a route's lines to show it on the canvas.</div>}
      <div className="source-body">
        {error && <div className="error small">{error}</div>}
        {text != null && (
          <YamlSnippet
            yaml={text}
            firstLine={1}
            wrap={wrap}
            ranges={ranges}
            highlight={selected ? [selected.start, selected.end] : null}
            onRangeClick={(r) => props.onSelectRoute(path, r.id)}
          />
        )}
      </div>
    </div>
  );
}
