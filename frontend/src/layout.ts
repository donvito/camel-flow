import dagre from '@dagrejs/dagre';
import { Position, type Edge, type Node } from '@xyflow/react';
import type { Direction } from './types';

/** Extra room at the top of group boxes for their title. */
export const GROUP_HEADER = 34;
const GROUP_PAD = 16;

export interface LayoutOptions {
  direction: Direction;
  nodesep?: number;
  ranksep?: number;
  /** Fallback size when a node has not been measured yet. */
  defaultSize?: (n: Node) => { width: number; height: number };
}

function sizeOf(n: Node, opts: LayoutOptions) {
  const w = n.measured?.width ?? (typeof n.width === 'number' ? n.width : undefined);
  const h = n.measured?.height ?? (typeof n.height === 'number' ? n.height : undefined);
  if (w && h) return { width: w, height: h };
  return opts.defaultSize?.(n) ?? { width: 240, height: 90 };
}

/**
 * Lays out nodes with dagre (compound when nodes have parentId). Returns nodes with positions
 * relative to their parent, as React Flow expects, and explicit sizes for group nodes.
 */
export function layoutGraph(nodes: Node[], edges: Edge[], opts: LayoutOptions): Node[] {
  const horizontal = opts.direction === 'LR';
  const g = new dagre.graphlib.Graph({ compound: true, multigraph: true });
  g.setGraph({
    rankdir: opts.direction,
    nodesep: opts.nodesep ?? (horizontal ? 36 : 56),
    ranksep: opts.ranksep ?? (horizontal ? 110 : 80),
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const parents = new Set(nodes.filter((n) => n.parentId).map((n) => n.parentId!));

  for (const n of nodes) {
    if (n.hidden) continue;
    if (parents.has(n.id)) {
      g.setNode(n.id, {});
    } else {
      g.setNode(n.id, sizeOf(n, opts));
    }
  }
  for (const n of nodes) {
    if (n.hidden || !n.parentId || !g.hasNode(n.parentId)) continue;
    g.setParent(n.id, n.parentId);
  }
  for (const e of edges) {
    if (e.hidden) continue;
    if (!g.hasNode(e.source) || !g.hasNode(e.target)) continue;
    if (parents.has(e.source) || parents.has(e.target)) continue; // dagre cannot route to clusters
    g.setEdge(e.source, e.target, {}, e.id);
  }

  dagre.layout(g);

  // Depth of nested groups below each group, so outer headers make room for inner ones.
  const nestedDepth = new Map<string, number>();
  const depthOf = (id: string): number => {
    if (nestedDepth.has(id)) return nestedDepth.get(id)!;
    let d = 0;
    for (const c of nodes) if (c.parentId === id && parents.has(c.id)) d = Math.max(d, depthOf(c.id) + 1);
    nestedDepth.set(id, d);
    return d;
  };

  const abs = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const n of nodes) {
    if (!g.hasNode(n.id)) continue;
    const d = g.node(n.id) as { x: number; y: number; width: number; height: number };
    if (d == null || d.x == null) continue;
    let { width, height } = d;
    let x = d.x - width / 2;
    let y = d.y - height / 2;
    if (parents.has(n.id)) {
      const extra = GROUP_HEADER * (depthOf(n.id) + 1) - GROUP_HEADER;
      y -= GROUP_HEADER + extra;
      height += GROUP_HEADER + extra + GROUP_PAD;
      x -= GROUP_PAD;
      width += GROUP_PAD * 2;
    }
    abs.set(n.id, { x, y, width, height });
  }

  return nodes.map((n) => {
    const a = abs.get(n.id);
    if (!a) return n;
    const parent = n.parentId ? abs.get(n.parentId) : undefined;
    const position = parent ? { x: a.x - parent.x, y: a.y - parent.y } : { x: a.x, y: a.y };
    const next: Node = {
      ...n,
      position,
      targetPosition: horizontal ? Position.Left : Position.Top,
      sourcePosition: horizontal ? Position.Right : Position.Bottom,
    };
    if (parents.has(n.id)) {
      next.style = { ...(n.style ?? {}), width: a.width, height: a.height };
      next.width = a.width;
      next.height = a.height;
    }
    return next;
  });
}
