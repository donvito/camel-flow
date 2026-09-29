import { useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import { exportPng, type ExportOptions } from './export';
import { useSettings } from './settings';
import { useAutoLayout } from './useAutoLayout';

export interface CanvasApi {
  exportPng: (opts: ExportOptions) => Promise<void>;
  resetLayout: () => void;
  fitView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Pans (without zooming out) so the node is on screen. */
  reveal: (id: string) => void;
}

const MINIMAP_COLORS: Record<string, string> = {
  route: 'var(--minimap-route)',
  api: 'var(--cat-http)',
  step: 'var(--minimap-route)',
};

function minimapColor(n: Node): string {
  if (n.type === 'system') {
    const cat = (n.data as { system?: { category?: string } }).system?.category ?? 'other';
    return `var(--cat-${cat})`;
  }
  if (n.type === 'fileGroup' || n.type === 'stepGroup') return 'transparent';
  return MINIMAP_COLORS[n.type ?? ''] ?? 'var(--muted)';
}

export function FlowCanvas(props: {
  scope: string;
  baseNodes: Node[];
  baseEdges: Edge[];
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
  structureKey: string;
  grouped: boolean;
  active: boolean;
  highlight: Set<string> | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpen?: (id: string) => void;
  register: (api: CanvasApi | null) => void;
  nodesep?: number;
  ranksep?: number;
}) {
  const settings = useSettings();
  const container = useRef<HTMLDivElement>(null);
  const rf = useReactFlow();
  const { nodes, edges, onNodesChange, onEdgesChange, onNodeDragStop, resetLayout } = useAutoLayout({
    scope: props.scope,
    baseNodes: props.baseNodes,
    baseEdges: props.baseEdges,
    structureKey: props.structureKey,
    direction: settings.direction,
    grouped: props.grouped,
    nodesep: props.nodesep,
    ranksep: props.ranksep,
  });

  // Register this canvas as the target of toolbar actions while it is visible
  const { register, active } = props;
  useEffect(() => {
    if (!active) return;
    register({
      exportPng: (opts) => exportPng(container.current!, rf.getNodes(), opts),
      resetLayout,
      fitView: () => rf.fitView({ padding: 0.12, duration: 300 }),
      zoomIn: () => rf.zoomIn({ duration: 150 }),
      zoomOut: () => rf.zoomOut({ duration: 150 }),
      reveal: (id) => {
        const n = rf.getInternalNode(id);
        if (!n) return;
        const { x, y } = n.internals.positionAbsolute;
        const w = n.measured.width ?? 200;
        const h = n.measured.height ?? 80;
        rf.setCenter(x + w / 2, y + h / 2, { zoom: Math.max(rf.getZoom(), 0.85), duration: 400 });
      },
    });
    return () => register(null);
  }, [active, register, resetLayout, rf]);

  // Keyboard zoom: + / - / 0
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '+' || e.key === '=') rf.zoomIn({ duration: 150 });
      else if (e.key === '-' || e.key === '_') rf.zoomOut({ duration: 150 });
      else if (e.key === '0') rf.fitView({ padding: 0.12, duration: 300 });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, rf]);

  const { highlight, selectedId } = props;
  const displayNodes = useMemo(() => {
    if (!highlight && !selectedId) return nodes;
    return nodes.map((n) => {
      const dim = highlight != null && !highlight.has(n.id) && n.type !== 'fileGroup' && n.type !== 'stepGroup';
      const base = (n.className ?? '').replace(/\s*(dimmed|focus)/g, '');
      const cls = `${base}${dim ? ' dimmed' : ''}${n.id === selectedId ? ' focus' : ''}`.trim();
      return cls === (n.className ?? '') ? n : { ...n, className: cls };
    });
  }, [nodes, highlight, selectedId]);

  const displayEdges = useMemo(() => {
    if (!highlight) return edges;
    return edges.map((e) => {
      const on = highlight.has(e.source) && highlight.has(e.target);
      return { ...e, className: on ? 'lit' : 'dimmed' };
    });
  }, [edges, highlight]);

  const onNodeClick: NodeMouseHandler = (_e, node) => {
    if (node.type === 'join') return;
    props.onSelect(node.id);
  };
  const onNodeDoubleClick: NodeMouseHandler = (_e, node) => props.onOpen?.(node.id);

  return (
    <div ref={container} className="canvas" style={{ display: props.active ? 'block' : 'none' }}>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={() => props.onSelect(null)}
        nodeTypes={props.nodeTypes}
        edgeTypes={props.edgeTypes}
        colorMode={settings.resolvedTheme}
        nodesDraggable
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable
        zoomOnDoubleClick={false}
        minZoom={0.1}
        maxZoom={2.5}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--grid)" />
        {!settings.presentation && <Controls showInteractive position="bottom-right" />}
        {settings.showMinimap && !settings.presentation && (
          <MiniMap pannable zoomable nodeColor={minimapColor} nodeStrokeWidth={2} position="bottom-left" />
        )}
      </ReactFlow>
    </div>
  );
}
