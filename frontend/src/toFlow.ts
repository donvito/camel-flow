import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Api, Graph, Link, Route, SystemNode } from './types';

export interface OverviewFilters {
  showSystems: boolean;
  showInternal: boolean;
  groupByFile: boolean;
  /** Show only this file's routes (plus faded neighbours from other files); null = all files. */
  file: string | null;
}

/** ghost = a route from another file, shown only because the selected file connects to it. */
export type RouteNodeData = { route: Route; ghost?: boolean };
export type SystemNodeData = { system: SystemNode; usedBy: number };
export type ApiNodeData = { api: Api; ghost?: boolean };
export type FileGroupData = { file: string; count: number };
export type LinkEdgeData = { link: Link };

export function isSystemVisible(s: SystemNode, f: OverviewFilters): boolean {
  if (!f.showSystems) return s.category === 'unresolved';
  if (s.internal && !f.showInternal) return false;
  return true;
}

/** Graph JSON → React Flow nodes/edges for the route overview (positions are filled by layout). */
export function overviewToFlow(graph: Graph, f: OverviewFilters): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const visible = new Set<string>();

  // Per-file view: the file's own routes/APIs, plus routes elsewhere that they link to (as ghosts)
  let routes = graph.routes;
  let apis = graph.apis;
  const ghosts = new Set<string>();
  if (f.file) {
    const own = new Set<string>();
    for (const r of graph.routes) if (r.file === f.file) own.add(r.id);
    for (const a of graph.apis) if (a.file === f.file) own.add(a.id);
    for (const l of graph.links) {
      const other = own.has(l.source) ? l.target : own.has(l.target) ? l.source : null;
      if (other && !own.has(other) && !other.startsWith('sys:')) ghosts.add(other);
    }
    routes = graph.routes.filter((r) => own.has(r.id) || ghosts.has(r.id));
    apis = graph.apis.filter((a) => own.has(a.id) || ghosts.has(a.id));
  }
  // Systems are only shown for fully visible routes, not for ghosts
  const systemUsers = new Set([...routes, ...apis].map((x) => x.id).filter((id) => !ghosts.has(id)));

  const usedBy = new Map<string, number>();
  for (const l of graph.links) {
    if (l.target.startsWith('sys:')) usedBy.set(l.target, (usedBy.get(l.target) ?? 0) + 1);
    if (l.source.startsWith('sys:')) usedBy.set(l.source, (usedBy.get(l.source) ?? 0) + 1);
  }

  const groupOf = (file: string) => `file:${file}`;
  if (f.groupByFile) {
    const counts = new Map<string, number>();
    for (const r of routes) counts.set(r.file, (counts.get(r.file) ?? 0) + 1);
    for (const a of apis) counts.set(a.file, (counts.get(a.file) ?? 0) + 1);
    for (const [file, count] of counts) {
      nodes.push({
        id: groupOf(file),
        type: 'fileGroup',
        position: { x: 0, y: 0 },
        data: { file, count } satisfies FileGroupData,
        selectable: true,
        zIndex: -1,
      });
    }
  }

  for (const a of apis) {
    visible.add(a.id);
    nodes.push({
      id: a.id,
      type: 'api',
      position: { x: 0, y: 0 },
      className: ghosts.has(a.id) ? 'ghost' : undefined,
      data: { api: a, ghost: ghosts.has(a.id) } satisfies ApiNodeData,
      parentId: f.groupByFile ? groupOf(a.file) : undefined,
    });
  }
  for (const r of routes) {
    visible.add(r.id);
    nodes.push({
      id: r.id,
      type: 'route',
      position: { x: 0, y: 0 },
      className: ghosts.has(r.id) ? 'ghost' : undefined,
      data: { route: r, ghost: ghosts.has(r.id) } satisfies RouteNodeData,
      parentId: f.groupByFile ? groupOf(r.file) : undefined,
    });
  }
  const usedByVisible = new Set<string>();
  for (const l of graph.links) {
    if (systemUsers.has(l.source)) usedByVisible.add(l.target);
    if (systemUsers.has(l.target)) usedByVisible.add(l.source);
  }
  for (const s of graph.systems) {
    if (!isSystemVisible(s, f)) continue;
    if (f.file && !usedByVisible.has(s.id)) continue;
    visible.add(s.id);
    nodes.push({
      id: s.id,
      type: 'system',
      position: { x: 0, y: 0 },
      data: { system: s, usedBy: usedBy.get(s.id) ?? 0 } satisfies SystemNodeData,
    });
  }

  const edges: Edge[] = graph.links
    .filter((l) => visible.has(l.source) && visible.has(l.target))
    .filter((l) => !(ghosts.has(l.source) && (ghosts.has(l.target) || l.target.startsWith('sys:'))))
    .filter((l) => !(ghosts.has(l.target) && l.source.startsWith('sys:')))
    .map((l) => ({
      id: l.id,
      source: l.source,
      target: l.target,
      type: 'link',
      data: { link: l } satisfies LinkEdgeData,
      animated: l.kind === 'event',
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    }));

  return { nodes, edges };
}

/** Lower-cased text used by search. */
export function searchText(n: Node): string {
  const d = n.data as Partial<RouteNodeData & SystemNodeData & ApiNodeData & FileGroupData>;
  if (d.route) {
    const r = d.route;
    return [r.title, r.routeId, r.description, r.fromUri, r.file, ...r.produces, ...r.steps.map((s) => s.label)]
      .join(' ')
      .toLowerCase();
  }
  if (d.system) return [d.system.label, d.system.detail, d.system.scheme, ...d.system.uris].join(' ').toLowerCase();
  if (d.api) return [d.api.method, d.api.path, d.api.description, d.api.toUri].join(' ').toLowerCase();
  if (d.file) return d.file.toLowerCase();
  return '';
}
