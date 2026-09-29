import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { CategoryIcon, CATEGORY_LABELS, TriggerIcon } from '../icons';
import { useSettings } from '../settings';
import type { RouteNodeData } from '../toFlow';

const CHIP_ORDER = ['ai', 'messaging', 'database', 'http', 'saas', 'email', 'file', 'cloud', 'other'];
const MAX_URIS = 6;

function RouteNodeImpl({ data, targetPosition, sourcePosition }: NodeProps<Node<RouteNodeData>>) {
  const { view } = useSettings();
  const r = data.route;
  const technical = view === 'technical';
  const chips = CHIP_ORDER.filter((c) => r.categoryCounts?.[c]);

  return (
    <div className={`route-card ${technical ? 'technical' : ''} ${r.template ? 'template' : ''}`}>
      <Handle type="target" position={targetPosition ?? Position.Left} />
      {data.ghost && <div className="ghost-file" title="Route from another file">{r.file}</div>}
      {r.template && <div className="ribbon">{r.kind === 'kamelet' ? 'Kamelet' : 'Template'}</div>}
      {r.trigger && (
        <div className={`trigger cat-${r.trigger.category}`} title={r.trigger.uri}>
          <TriggerIcon category={r.trigger.category} size={13} />
          <span>{r.trigger.label}</span>
        </div>
      )}
      <div className="route-title">{r.title}</div>
      {technical && r.title !== r.routeId && <div className="mono muted small">{r.routeId}</div>}
      {!technical && r.description && r.description !== r.title && <div className="route-desc">{r.description}</div>}
      {!technical && chips.length > 0 && (
        <div className="chips">
          {chips.map((c) => (
            <span key={c} className={`chip cat-${c}`} title={CATEGORY_LABELS[c]}>
              <CategoryIcon category={c} size={12} />
              {CATEGORY_LABELS[c]}
              {r.categoryCounts[c] > 1 && <b>×{r.categoryCounts[c]}</b>}
            </span>
          ))}
        </div>
      )}
      {technical && (
        <div className="tech-block">
          {r.fromUri && (
            <div className="uri-row">
              <span className="uri-dir">from</span>
              <span className="mono" title={r.fromUri}>{r.fromUri}</span>
            </div>
          )}
          {r.produces.slice(0, MAX_URIS).map((u) => (
            <div key={u} className="uri-row">
              <span className="uri-dir">to</span>
              <span className="mono" title={u}>{u}</span>
            </div>
          ))}
          {r.produces.length > MAX_URIS && <div className="muted small">+{r.produces.length - MAX_URIS} more</div>}
          <div className="tech-footer muted small">
            {r.stepCount} {r.stepCount === 1 ? 'step' : 'steps'} · {r.file}:{r.lines[0]}
            {r.warnings.length > 0 && <span className="warn-dot" title={r.warnings.join('\n')}> ⚠ {r.warnings.length}</span>}
          </div>
        </div>
      )}
      <Handle type="source" position={sourcePosition ?? Position.Right} />
    </div>
  );
}

export const RouteNode = memo(RouteNodeImpl);
