import { ArrowDownLeft, ArrowUpRight, Workflow, X } from 'lucide-react';
import { CategoryIcon, StepIcon, TriggerIcon } from '../icons';
import { useSettings } from '../settings';
import type { Graph, Route, StepNode } from '../types';
import { YamlSnippet } from './YamlSnippet';

export type Selection =
  | { type: 'route'; id: string }
  | { type: 'system'; id: string }
  | { type: 'api'; id: string }
  | { type: 'step'; step: StepNode; route: Route };

function nameOf(graph: Graph, id: string): string {
  const r = graph.routes.find((x) => x.id === id);
  if (r) return r.title;
  const s = graph.systems.find((x) => x.id === id);
  if (s) return s.detail ? `${s.label} · ${s.detail}` : s.label;
  const a = graph.apis.find((x) => x.id === id);
  if (a) return `${a.method} ${a.path}`;
  return id;
}

function Connections({ graph, id, onSelect }: { graph: Graph; id: string; onSelect: (id: string) => void }) {
  const { view } = useSettings();
  const incoming = graph.links.filter((l) => l.target === id);
  const outgoing = graph.links.filter((l) => l.source === id);
  if (incoming.length === 0 && outgoing.length === 0) return null;
  const row = (other: string, label: string | undefined, key: string | undefined, dir: 'in' | 'out') => (
    <li key={`${dir}-${other}-${key}`}>
      <button className="link-btn" onClick={() => onSelect(other)}>
        {dir === 'in' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
        <span>{nameOf(graph, other)}</span>
      </button>
      {(view === 'technical' ? key : label) && <span className="muted small"> · {view === 'technical' ? key : label}</span>}
    </li>
  );
  return (
    <section>
      <h4>Connections</h4>
      <ul className="plain">
        {incoming.map((l) => row(l.source, l.label, l.linkKey, 'in'))}
        {outgoing.map((l) => row(l.target, l.label, l.linkKey, 'out'))}
      </ul>
    </section>
  );
}

function StepTree({ steps }: { steps?: StepNode[] }) {
  if (!steps || steps.length === 0) return null;
  return (
    <ul className="step-tree">
      {steps.map((s, i) => (
        <li key={i} className={s.disabled ? 'disabled' : ''}>
          <span className="mono kind">{s.kind}</span> {s.uri ? <span className="mono">{s.uri}</span> : <span>{s.label}</span>}
          {s.expression && <div className="mono small muted">{s.expression}</div>}
          {s.branches?.map((b, j) => (
            <div key={j} className="branch">
              <div className="mono small branch-label">
                {b.label}
                {b.expression ? ` · ${b.expression}` : ''}
              </div>
              <StepTree steps={b.steps} />
            </div>
          ))}
          <StepTree steps={s.children} />
        </li>
      ))}
    </ul>
  );
}

function Params({ params }: { params?: Record<string, unknown> }) {
  if (!params || Object.keys(params).length === 0) return null;
  return (
    <table className="params">
      <tbody>
        {Object.entries(params).map(([k, v]) => (
          <tr key={k}>
            <td className="mono muted">{k}</td>
            <td className="mono">{typeof v === 'string' ? v : JSON.stringify(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DetailsPanel(props: {
  graph: Graph;
  selection: Selection;
  onClose: () => void;
  onSelect: (id: string) => void;
  onOpenFlow: (routeId: string) => void;
  onViewSource: (path: string, routeId?: string) => void;
}) {
  const { view } = useSettings();
  const technical = view === 'technical';
  const { graph, selection } = props;

  let body: React.ReactNode = null;
  if (selection.type === 'route') {
    const r = graph.routes.find((x) => x.id === selection.id);
    if (!r) return null;
    body = (
      <>
        <div className="panel-kicker">{r.template ? (r.kind === 'kamelet' ? 'Kamelet' : 'Route template') : r.kind === 'pipe' ? 'Pipe' : 'Route'}</div>
        <h3>{r.title}</h3>
        {r.trigger && (
          <div className={`trigger cat-${r.trigger.category}`}>
            <TriggerIcon category={r.trigger.category} size={13} /> {r.trigger.label}
          </div>
        )}
        {r.description && r.description !== r.title && <p>{r.description}</p>}
        {r.note && <p className="note">{r.note}</p>}
        <button className="primary" onClick={() => props.onOpenFlow(r.id)}>
          <Workflow size={14} /> Open step-by-step flow
        </button>
        {!technical && r.steps.length > 0 && (
          <section>
            <h4>What it does</h4>
            <ol className="plain-steps">
              {r.steps.map((s, i) => (
                <li key={i}>
                  <StepIcon kind="" category={s.category} size={13} /> {s.label}
                </li>
              ))}
            </ol>
          </section>
        )}
        <Connections graph={graph} id={r.id} onSelect={props.onSelect} />
        {technical && (
          <>
            <section>
              <h4>Source</h4>
              <dl className="kv">
                <dt>Route id</dt>
                <dd className="mono">{r.routeId}</dd>
                <dt>File</dt>
                <dd className="mono">
                  {r.file}:{r.lines[0]}–{r.lines[1]}
                </dd>
                {r.fromUri && (
                  <>
                    <dt>From</dt>
                    <dd className="mono">{r.fromUri}</dd>
                  </>
                )}
                <dt>Steps</dt>
                <dd>{r.stepCount}</dd>
              </dl>
            </section>
            {r.produces.length > 0 && (
              <section>
                <h4>Sends to</h4>
                <ul className="plain mono small">
                  {r.produces.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </section>
            )}
            <section>
              <h4>Step tree</h4>
              <StepTree steps={r.stepTree.children} />
            </section>
            {r.warnings.length > 0 && (
              <section>
                <h4>Warnings</h4>
                <ul className="plain small warn">
                  {r.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </section>
            )}
            {r.yaml && (
              <section>
                <h4 className="with-action">
                  YAML
                  <button className="link-btn small" onClick={() => props.onViewSource(r.file, r.id)}>
                    Open full file
                  </button>
                </h4>
                <YamlSnippet yaml={r.yaml} firstLine={r.lines[0]} />
              </section>
            )}
          </>
        )}
      </>
    );
  } else if (selection.type === 'system') {
    const s = graph.systems.find((x) => x.id === selection.id);
    if (!s) return null;
    body = (
      <>
        <div className="panel-kicker">
          <CategoryIcon category={s.category} size={13} /> {s.category === 'unresolved' ? 'Missing route' : 'External system'}
        </div>
        <h3>{s.label}</h3>
        {s.detail && <p>{s.detail}</p>}
        {s.category === 'unresolved' && <p className="warn">No route in this folder consumes this endpoint.</p>}
        <Connections graph={graph} id={s.id} onSelect={props.onSelect} />
        {technical && s.uris.length > 0 && (
          <section>
            <h4>Endpoint URIs</h4>
            <ul className="plain mono small">
              {s.uris.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  } else if (selection.type === 'api') {
    const a = graph.apis.find((x) => x.id === selection.id);
    if (!a) return null;
    body = (
      <>
        <div className="panel-kicker">REST endpoint</div>
        <h3>
          <span className={`method m-${a.method.toLowerCase()}`}>{a.method}</span> {a.path}
        </h3>
        {a.description && <p>{a.description}</p>}
        <Connections graph={graph} id={a.id} onSelect={props.onSelect} />
        {technical && (
          <dl className="kv">
            <dt>File</dt>
            <dd className="mono">{a.file}</dd>
            {a.toUri && (
              <>
                <dt>To</dt>
                <dd className="mono">{a.toUri}</dd>
              </>
            )}
          </dl>
        )}
      </>
    );
  } else {
    const s = selection.step;
    body = (
      <>
        <div className="panel-kicker">
          <StepIcon kind={s.kind} category={s.category} size={13} /> {technical ? s.kind : 'Step'} in {selection.route.title}
        </div>
        <h3>{s.label ?? s.kind}</h3>
        {s.system && s.category !== 'eip' && <p>{s.system}</p>}
        {s.note && <p className="note">{s.note}</p>}
        {s.dynamic && <p className="warn small">Destination is computed at runtime.</p>}
        {technical && (
          <>
            <dl className="kv">
              <dt>EIP</dt>
              <dd className="mono">{s.kind}</dd>
              {s.id && (
                <>
                  <dt>Id</dt>
                  <dd className="mono">{s.id}</dd>
                </>
              )}
              {s.uri && (
                <>
                  <dt>URI</dt>
                  <dd className="mono">{s.uri}</dd>
                </>
              )}
              {s.expression && (
                <>
                  <dt>Expression</dt>
                  <dd className="mono">{s.expression}</dd>
                </>
              )}
              {s.linkKey && (
                <>
                  <dt>Link key</dt>
                  <dd className="mono">{s.linkKey}</dd>
                </>
              )}
            </dl>
            <Params params={s.parameters} />
          </>
        )}
      </>
    );
  }

  return (
    <div className="details-content" aria-label="Details">
      <button className="close" onClick={props.onClose} aria-label="Close details" title="Close (Esc)">
        <X size={16} />
      </button>
      {body}
    </div>
  );
}
