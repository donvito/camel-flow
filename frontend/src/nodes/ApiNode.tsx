import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Webhook } from 'lucide-react';
import { useSettings } from '../settings';
import type { ApiNodeData } from '../toFlow';

function ApiNodeImpl({ data, targetPosition, sourcePosition }: NodeProps<Node<ApiNodeData>>) {
  const { view } = useSettings();
  const a = data.api;
  return (
    <div className="api-node">
      <Handle type="target" position={targetPosition ?? Position.Left} />
      <div className="api-head">
        <Webhook size={14} aria-hidden />
        <span className={`method m-${a.method.toLowerCase()}`}>{a.method}</span>
        <span className="api-path">{a.path}</span>
      </div>
      {a.description && <div className="api-desc">{a.description}</div>}
      {view === 'technical' && a.toUri && <div className="mono small muted">→ {a.toUri}</div>}
      <Handle type="source" position={sourcePosition ?? Position.Right} />
    </div>
  );
}

export const ApiNode = memo(ApiNodeImpl);
