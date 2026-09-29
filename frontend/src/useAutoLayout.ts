import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type OnNodeDrag,
  type XYPosition,
} from '@xyflow/react';
import { GROUP_HEADER, layoutGraph } from './layout';
import { load, remove, save } from './storage';
import type { Direction } from './types';

type Saved = Record<string, XYPosition>;

const GROUP_PAD = 16;

function storageKey(scope: string) {
  return `cwv.pos:${scope}`;
}

/**
 * Keeps React Flow nodes laid out:
 *  - nodes the user dragged keep their saved position (per scope, in localStorage),
 *  - nodes that already exist keep their position across live reloads,
 *  - everything else is placed by dagre once React Flow has measured it.
 * A change of `structureKey` (view, direction, grouping, filters) re-lays out every unsaved node.
 */
export function useAutoLayout(opts: {
  scope: string;
  baseNodes: Node[];
  baseEdges: Edge[];
  structureKey: string;
  direction: Direction;
  grouped: boolean;
  nodesep?: number;
  ranksep?: number;
}) {
  const { scope, baseNodes, baseEdges, structureKey, direction, grouped } = opts;
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [pending, setPending] = useState(false);
  const [firstLayout, setFirstLayout] = useState(true);
  const lastStructure = useRef<string | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const { fitView } = useReactFlow();
  nodesRef.current = nodes;

  // Rebuild from data: reuse known positions, mark the rest for layout
  useEffect(() => {
    const structureChanged = lastStructure.current !== structureKey;
    lastStructure.current = structureKey;
    const saved = load<Saved>(storageKey(scope), {});
    const current = new Map(nodesRef.current.map((n) => [n.id, n]));
    let needsLayout = false;
    const next = baseNodes.map((n) => {
      const c = current.get(n.id);
      const measured = !structureChanged && c?.measured ? { measured: c.measured } : {};
      const isGroup = n.type === 'fileGroup' || n.type === 'stepGroup';
      if (saved[n.id] && !isGroup) {
        return { ...n, ...measured, position: saved[n.id] };
      }
      if (c && !structureChanged && !c.className?.includes('pending')) {
        return { ...n, ...measured, position: c.position, style: isGroup ? c.style : n.style, width: c.width, height: c.height };
      }
      needsLayout = true;
      return { ...n, position: { x: 0, y: 0 }, className: `${n.className ?? ''} pending` };
    });
    setNodes(grouped && !needsLayout ? fitGroups(next) : next);
    setEdges(baseEdges);
    if (needsLayout) setPending(true);
  }, [baseNodes, baseEdges, structureKey, scope]);

  // Once every node is measured, run dagre for the pending ones
  useEffect(() => {
    if (!pending) return;
    const measurable = nodes.filter((n) => !n.hidden && n.type !== 'fileGroup' && n.type !== 'stepGroup');
    if (measurable.length > 0 && !measurable.every((n) => n.measured?.width && n.measured?.height)) return;
    const laid = layoutGraph(nodes, edges, { direction, nodesep: opts.nodesep, ranksep: opts.ranksep });
    const laidById = new Map(laid.map((n) => [n.id, n]));
    let next: Node[] = nodes.map((n): Node => {
      const l = laidById.get(n.id)!;
      const wasPending = n.className?.includes('pending');
      const className = n.className?.replace(/\s*pending/g, '').trim() || undefined;
      const isGroup = n.type === 'fileGroup' || n.type === 'stepGroup';
      if (wasPending || isGroup) {
        return { ...l, className };
      }
      return { ...n, targetPosition: l.targetPosition, sourcePosition: l.sourcePosition, className };
    });
    if (grouped) next = fitGroups(next);
    setNodes(next);
    setPending(false);
    const wasFirst = firstLayout;
    setFirstLayout(false);
    requestAnimationFrame(() => fitView({ padding: 0.12, duration: wasFirst ? 0 : 300 }));
  }, [pending, nodes]);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_e, node) => {
      const saved = load<Saved>(storageKey(scope), {});
      const dragged = nodesRef.current.filter((n) => n.selected || n.id === node.id);
      for (const n of dragged) {
        if (n.type === 'fileGroup' || n.type === 'stepGroup') {
          // moving a group moves its children; remember the children's new places
          saved[n.id] = n.position;
        } else {
          saved[n.id] = n.id === node.id ? node.position : n.position;
        }
      }
      save(storageKey(scope), saved);
      if (grouped) setNodes((ns) => fitGroups(ns));
    },
    [scope, grouped, setNodes],
  );

  const resetLayout = useCallback(() => {
    remove(storageKey(scope));
    setNodes((ns) => ns.map((n) => ({ ...n, className: `${n.className ?? ''} pending` })));
    setPending(true);
  }, [scope, setNodes]);

  return { nodes, edges, setNodes, onNodesChange, onEdgesChange, onNodeDragStop, resetLayout, laidOut: !pending };
}

/** Resizes group nodes to wrap their children (after drags or when positions come from storage). */
export function fitGroups(nodes: Node[]): Node[] {
  const groups = nodes.filter((n) => n.type === 'fileGroup' || n.type === 'stepGroup');
  if (groups.length === 0) return nodes;
  let result = nodes;
  // innermost groups first so outer groups see final child sizes
  const depth = (n: Node): number => {
    let d = 0;
    let p = n.parentId;
    while (p) {
      d++;
      p = result.find((x) => x.id === p)?.parentId;
    }
    return d;
  };
  const ordered = [...groups].sort((a, b) => depth(b) - depth(a));
  for (const g of ordered) {
    const kids = result.filter((n) => n.parentId === g.id);
    if (kids.length === 0) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const k of kids) {
      const w = (k.measured?.width ?? (k.width as number | undefined) ?? 200) as number;
      const h = (k.measured?.height ?? (k.height as number | undefined) ?? 80) as number;
      minX = Math.min(minX, k.position.x);
      minY = Math.min(minY, k.position.y);
      maxX = Math.max(maxX, k.position.x + w);
      maxY = Math.max(maxY, k.position.y + h);
    }
    const dx = minX - GROUP_PAD;
    const dy = minY - GROUP_HEADER;
    const width = maxX - minX + GROUP_PAD * 2;
    const height = maxY - minY + GROUP_HEADER + GROUP_PAD;
    result = result.map((n) => {
      if (n.id === g.id) {
        return {
          ...n,
          position: { x: n.position.x + dx, y: n.position.y + dy },
          style: { ...(n.style ?? {}), width, height },
          width,
          height,
        };
      }
      if (n.parentId === g.id) {
        return { ...n, position: { x: n.position.x - dx, y: n.position.y - dy } };
      }
      return n;
    });
  }
  return result;
}
