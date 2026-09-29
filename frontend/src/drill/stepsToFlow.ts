import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Branch, Route, StepNode } from '../types';

export type StepNodeData = {
  step: StepNode;
  isFrom?: boolean;
  target?: { id: string; title: string };
};
export type StepGroupData = { step: StepNode };

interface Exit {
  id: string;
  label?: string;
  technicalLabel?: string;
}

function branchLabels(b: Branch): { label: string; technicalLabel: string } {
  const raw = b.label ?? '';
  const plain =
    raw === 'when' ? 'If' : raw === 'otherwise' ? 'Otherwise' : raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
  const technical = b.expression ? (raw === 'when' ? b.expression : `${raw}: ${b.expression}`) : raw;
  return { label: plain, technicalLabel: technical };
}

/**
 * A route's step tree → React Flow nodes/edges: sequences chain left-to-right, branching EIPs
 * (choice, doTry, multicast, circuitBreaker) fan out and merge at a join dot, and EIPs with nested
 * steps (split, loop, aggregate, filter...) become group boxes around their children.
 */
export function stepsToFlow(
  route: Route,
  opts: { showInternal: boolean; routeByKey: Map<string, { id: string; title: string }> },
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let counter = 0;
  const nid = () => `n${counter++}`;

  const visible = (s: StepNode) => opts.showInternal || ((!s.internal || !!s.description) && !s.disabled);

  const connect = (from: Exit[], to: string) => {
    for (const f of from) {
      edges.push({
        id: `e${edges.length}:${f.id}->${to}`,
        source: f.id,
        target: to,
        type: 'link',
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        data: { kind: 'flow', step: true, label: f.label, technicalLabel: f.technicalLabel ?? f.label },
      });
    }
  };

  const addStep = (step: StepNode, parentId: string | undefined, isFrom = false): string => {
    const id = nid();
    const target = step.linkKey && !isFrom ? opts.routeByKey.get(step.linkKey) : undefined;
    nodes.push({
      id,
      type: 'step',
      position: { x: 0, y: 0 },
      parentId,
      data: { step, isFrom, target: target && target.id !== route.id ? target : undefined } satisfies StepNodeData,
    });
    return id;
  };

  const seq = (steps: StepNode[], parentId: string | undefined, entry: Exit[]): Exit[] => {
    let prev = entry;
    for (const step of steps) {
      if (!visible(step)) continue;
      const branches = step.branches ?? [];
      const children = (step.children ?? []).filter(visible);
      if (branches.length > 0) {
        const id = addStep(step, parentId);
        connect(prev, id);
        const join = nid();
        nodes.push({ id: join, type: 'join', position: { x: 0, y: 0 }, parentId, data: {}, selectable: false });
        for (const b of branches) {
          const labels = branchLabels(b);
          const exits = seq(b.steps ?? [], parentId, [{ id, ...labels }]);
          connect(exits, join);
        }
        prev = [{ id: join }];
      } else if (children.length > 0) {
        const gid = nid();
        nodes.push({
          id: gid,
          type: 'stepGroup',
          position: { x: 0, y: 0 },
          parentId,
          data: { step } satisfies StepGroupData,
          zIndex: -1,
        });
        prev = seq(children, gid, prev);
      } else {
        const id = addStep(step, parentId);
        connect(prev, id);
        prev = [{ id }];
      }
    }
    return prev;
  };

  const fromId = addStep(route.stepTree, undefined, true);
  seq(route.stepTree.children ?? [], undefined, [{ id: fromId }]);
  return { nodes, edges };
}
