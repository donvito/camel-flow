import { memo } from 'react';
import { BaseEdge, EdgeText, Position, getBezierPath, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import { useSettings } from '../settings';
import type { Link } from '../types';

export type LinkEdgeData = { link?: Link; label?: string; technicalLabel?: string; kind?: string; step?: boolean };

const FONT_SIZE = 11;
/** Average glyph width for the 11px UI font; monospace-ish link keys are a little wider. */
const CHAR_WIDTH = 6.4;
const LABEL_PAD = 6;

/** Shortens a label with "…" so it fits in maxWidth pixels. */
function fit(label: string, maxWidth: number): string {
  const maxChars = Math.floor((maxWidth - LABEL_PAD * 2) / CHAR_WIDTH);
  if (label.length <= maxChars) return label;
  if (maxChars < 4) return '';
  return label.slice(0, maxChars - 1) + '…';
}

/**
 * One edge type for both canvases. Labels are SVG (not EdgeLabelRenderer HTML) so PNG export
 * includes them, and they are shortened to fit the gap between cards so cards never hide them;
 * hovering a shortened label shows it in full.
 */
function LinkEdgeImpl(props: EdgeProps<Edge<LinkEdgeData>>) {
  const { view } = useSettings();
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data } = props;
  const kind = data?.link?.kind ?? data?.kind ?? 'call';
  const [path, labelX, labelY] = data?.step
    ? getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 10 })
    : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  // Fan-out edges (route → many systems) share their midpoint region near the route, so place
  // their labels towards the system end instead (and towards the source for fan-in "triggers").
  let w = 0.5;
  let lx = labelX;
  let ly = labelY;
  if (kind === 'uses' || kind === 'triggers') {
    w = kind === 'uses' ? 0.78 : 0.22;
    lx = sourceX + (targetX - sourceX) * w;
    ly = sourceY + (targetY - sourceY) * w;
  }

  const plain = data?.link?.label ?? data?.label ?? '';
  // API cards already show their target, so their lines stay unlabelled
  const technical = kind === 'api' ? '' : data?.link?.linkKey ?? data?.technicalLabel ?? plain;
  const full = view === 'technical' ? technical : plain;

  // Room between the two cards along the flow direction; the label must fit on both sides of its anchor
  const horizontal = sourcePosition === Position.Right || sourcePosition === Position.Left;
  const gap = horizontal ? Math.abs(targetX - sourceX) : Math.abs(targetY - sourceY);
  const maxWidth = horizontal ? 2 * Math.min(w, 1 - w) * gap - 8 : Infinity;
  const label = full ? fit(full, maxWidth) : '';
  const truncated = label !== full;

  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={markerEnd} className={`link-edge kind-${kind}`} interactionWidth={18} />
      {label && (
        <g className="edge-label">
          {truncated && <title>{full}</title>}
          <EdgeText
            x={lx}
            y={ly}
            label={label}
            labelStyle={{ fill: 'var(--edge-label)', fontSize: FONT_SIZE, fontWeight: 500 }}
            labelShowBg
            labelBgPadding={[LABEL_PAD, 3]}
            labelBgBorderRadius={6}
            labelBgStyle={{ fill: 'var(--edge-label-bg)', stroke: 'var(--border)', strokeWidth: 0.5 }}
          />
        </g>
      )}
    </>
  );
}

export const LinkEdge = memo(LinkEdgeImpl);
