import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CategoryIcon, CATEGORY_LABELS } from '../icons';
import { useSettings } from '../settings';
import type { Graph } from '../types';

const EDGE_KINDS: { kind: string; label: string; technical: string }[] = [
  { kind: 'call', label: 'Calls (waits for the answer)', technical: 'direct / kamelet' },
  { kind: 'async', label: 'Hands off (in the background)', technical: 'seda / vm / disruptor' },
  { kind: 'event', label: 'Publishes an event', technical: 'kafka / jms / amqp / pubsub …' },
  { kind: 'uses', label: 'Uses a system', technical: 'to / enrich / poll' },
  { kind: 'triggers', label: 'Is triggered by', technical: 'from' },
];

export function Legend({ graph }: { graph: Graph }) {
  const { view } = useSettings();
  const [open, setOpen] = useState(false);
  const cats = new Set(graph.systems.map((s) => s.category));
  for (const r of graph.routes) Object.keys(r.categoryCounts ?? {}).forEach((c) => cats.add(c as never));

  return (
    <div className={`legend ${open ? 'open' : ''}`}>
      <button className="legend-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        Legend {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      {open && (
        <div className="legend-body">
          <div className="legend-section">
            {EDGE_KINDS.map((e) => (
              <div key={e.kind} className="legend-row">
                <svg width="38" height="10" aria-hidden>
                  <path d="M1 5 H37" className={`legend-line kind-${e.kind}`} />
                </svg>
                <span>{view === 'technical' ? `${e.label} — ${e.technical}` : e.label}</span>
              </div>
            ))}
          </div>
          <div className="legend-section cats">
            {[...cats].map((c) => (
              <span key={c} className={`chip cat-${c}`}>
                <CategoryIcon category={c} size={12} /> {CATEGORY_LABELS[c] ?? c}
              </span>
            ))}
          </div>
          <div className="muted small">Double-click a route to see its steps. Drag to rearrange.</div>
        </div>
      )}
    </div>
  );
}
