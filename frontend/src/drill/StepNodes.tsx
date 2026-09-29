import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronRight } from 'lucide-react';
import { StepIcon, TriggerIcon } from '../icons';
import { useSettings } from '../settings';
import type { StepGroupData, StepNodeData } from './stepsToFlow';

export const OPEN_ROUTE_EVENT = 'cwv:open-route';

function StepNodeImpl({ data, targetPosition, sourcePosition }: NodeProps<Node<StepNodeData>>) {
  const { view } = useSettings();
  const s = data.step;
  const technical = view === 'technical';
  const cls = [
    'step-node',
    `cat-${s.category ?? 'eip'}`,
    data.isFrom ? 'is-from' : '',
    s.disabled ? 'disabled' : '',
    s.dynamic ? 'dynamic' : '',
  ].join(' ');

  // Name the route being called instead of its endpoint ("Calls Failed ticket parking")
  let label = s.label ?? s.kind;
  if (data.target && !s.description && !technical) {
    const verb = s.kind === 'wireTap' ? 'Sends a copy to' : /^(seda|vm|disruptor)/.test(s.linkKey ?? '') ? 'Hands off to' : 'Calls';
    label = `${verb} ${data.target.title}`;
  }

  return (
    <div className={cls} title={s.note ?? undefined}>
      {!data.isFrom && <Handle type="target" position={targetPosition ?? Position.Left} />}
      <div className="step-head">
        <span className="step-icon">
          {data.isFrom ? <TriggerIcon category={s.category} size={15} /> : <StepIcon kind={s.kind} category={s.category} />}
        </span>
        <div className="step-main">
          {technical && <div className="step-kind mono">{data.isFrom ? 'from' : s.kind}{s.id ? ` · ${s.id}` : ''}</div>}
          <div className="step-label">{label}</div>
          {!technical && !data.isFrom && !data.target && s.system && s.category !== 'eip' && !label.includes(s.system) && (
            <div className="step-system">{s.system}</div>
          )}
        </div>
      </div>
      {technical && s.uri && (
        <div className="mono small step-detail" title={s.uri}>
          {s.uri}
        </div>
      )}
      {technical && s.expression && (
        <div className="mono small step-detail expr" title={s.expression}>
          {s.expression}
        </div>
      )}
      {s.disabled && <div className="small muted">disabled</div>}
      {data.target && (
        <button
          className="step-jump nodrag"
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent(OPEN_ROUTE_EVENT, { detail: data.target!.id }));
          }}
          title="Open this route's flow"
        >
          {technical ? data.target.title : 'Open flow'} <ChevronRight size={12} />
        </button>
      )}
      <Handle type="source" position={sourcePosition ?? Position.Right} />
    </div>
  );
}

export const StepNodeView = memo(StepNodeImpl);

function StepGroupImpl({ data }: NodeProps<Node<StepGroupData>>) {
  const { view } = useSettings();
  const s = data.step;
  return (
    <div className="step-group">
      <div className="group-header">
        <StepIcon kind={s.kind} size={13} />
        <span>{s.label ?? s.kind}</span>
        {view === 'technical' && (
          <span className="mono small muted">
            {s.kind}
            {s.expression ? ` · ${s.expression}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export const StepGroupNode = memo(StepGroupImpl);

function JoinNodeImpl({ targetPosition, sourcePosition }: NodeProps) {
  return (
    <div className="join-node">
      <Handle type="target" position={targetPosition ?? Position.Left} />
      <Handle type="source" position={sourcePosition ?? Position.Right} />
    </div>
  );
}

export const JoinNode = memo(JoinNodeImpl);
