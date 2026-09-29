import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { CategoryIcon } from '../icons';
import { useSettings } from '../settings';
import type { SystemNodeData } from '../toFlow';

function SystemNodeImpl({ data, targetPosition, sourcePosition }: NodeProps<Node<SystemNodeData>>) {
  const { view } = useSettings();
  const s = data.system;
  const technical = view === 'technical';
  const cls = [
    'system-node',
    `cat-${s.category}`,
    s.dynamic ? 'dynamic' : '',
    s.category === 'unresolved' ? 'unresolved' : '',
    s.internal ? 'internal' : '',
  ].join(' ');

  return (
    <div className={cls}>
      <Handle type="target" position={targetPosition ?? Position.Left} />
      <div className="system-icon">
        <CategoryIcon category={s.category} size={18} />
      </div>
      <div className="system-text">
        <div className="system-label">{s.label}</div>
        {s.detail && <div className="system-detail">{s.detail}</div>}
        {technical &&
          s.uris.slice(0, 3).map((u) => (
            <div key={u} className="mono small muted system-uri" title={u}>
              {u}
            </div>
          ))}
        {technical && s.uris.length > 3 && <div className="small muted">+{s.uris.length - 3} more</div>}
      </div>
      <Handle type="source" position={sourcePosition ?? Position.Right} />
    </div>
  );
}

export const SystemNodeView = memo(SystemNodeImpl);
