import { useEffect, useRef, type ReactNode } from 'react';

const TOKEN = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\$\{[^}]*\}|\{\{[^}]*\}\})/g;
const KEY = /^(\s*(?:-\s+)?)([\w.$@-]+)(:)(?=\s|$)/;

function highlightRest(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const cls = m[1] ? 'y-comment' : m[2] ? 'y-string' : 'y-expr';
    out.push(
      <span key={`${keyBase}-${i++}`} className={cls}>
        {m[0]}
      </span>,
    );
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export interface LineRange {
  id: string;
  title: string;
  start: number;
  end: number;
}

/**
 * Read-only YAML with light syntax colouring and source line numbers. Lines that belong to a
 * route can be clicked (onRangeClick), and one range can be highlighted and scrolled into view.
 */
export function YamlSnippet({
  yaml,
  firstLine,
  wrap = false,
  highlight,
  ranges,
  onRangeClick,
}: {
  yaml: string;
  firstLine: number;
  wrap?: boolean;
  highlight?: [number, number] | null;
  ranges?: LineRange[];
  onRangeClick?: (r: LineRange) => void;
}) {
  const lines = yaml.replace(/\n$/, '').split('\n');
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!highlight || !ref.current) return;
    const el = ref.current.querySelector<HTMLElement>(`[data-line="${highlight[0]}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlight]);

  const rangeAt = (line: number) => ranges?.find((r) => line >= r.start && line <= r.end);

  return (
    <pre ref={ref} className={`yaml ${wrap ? 'wrap' : ''}`} aria-label="YAML source">
      {lines.map((line, n) => {
        const num = firstLine + n;
        const m = KEY.exec(line);
        const range = rangeAt(num);
        const lit = highlight && num >= highlight[0] && num <= highlight[1];
        return (
          <div
            key={n}
            data-line={num}
            className={`y-line ${lit ? 'lit' : ''} ${range && onRangeClick ? 'clickable' : ''} ${range?.start === num ? 'range-start' : ''}`}
            onClick={range && onRangeClick ? () => onRangeClick(range) : undefined}
            title={range && onRangeClick ? `Show “${range.title}” on the canvas` : undefined}
          >
            <span className="y-num">{num}</span>
            <span className="y-code">
              {m ? (
                <>
                  {m[1]}
                  <span className="y-key">{m[2]}</span>
                  {m[3]}
                  {highlightRest(line.slice(m[0].length), `${n}`)}
                </>
              ) : (
                highlightRest(line, `${n}`)
              )}
            </span>
          </div>
        );
      })}
    </pre>
  );
}
