import { toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';

export type ExportBackground = 'transparent' | 'theme' | 'white';

export interface ExportOptions {
  background: ExportBackground;
  scale: 1 | 2 | 3;
  theme?: 'light' | 'dark';
  fileName: string;
}

const PADDING = 40;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Renders the whole graph (not just what is on screen) to a PNG and downloads it.
 * The viewport element only contains nodes and edges, so controls, minimap and the dot grid are
 * never part of the image; `.exporting` on the container neutralises selection and dimming.
 */
export async function exportPng(container: HTMLElement, nodes: Node[], opts: ExportOptions): Promise<void> {
  const viewport = container.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport) throw new Error('Nothing to export');
  const visible = nodes.filter((n) => !n.hidden);
  if (visible.length === 0) throw new Error('Nothing to export');

  const bounds = getNodesBounds(visible);
  const width = Math.ceil(bounds.width + PADDING * 2);
  const height = Math.ceil(bounds.height + PADDING * 2);
  const vp = getViewportForBounds(bounds, width, height, 1, 1, 0);

  const root = document.documentElement;
  const previousTheme = root.dataset.theme;
  container.classList.add('exporting');
  if (opts.theme && opts.theme !== previousTheme) {
    root.dataset.theme = opts.theme;
  }
  await nextFrame();
  await nextFrame();

  try {
    const styles = getComputedStyle(container);
    const backgroundColor =
      opts.background === 'transparent'
        ? undefined
        : opts.background === 'white'
          ? '#ffffff'
          : styles.getPropertyValue('--canvas-bg').trim() || '#ffffff';

    const dataUrl = await toPng(viewport, {
      backgroundColor,
      width,
      height,
      pixelRatio: opts.scale,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
      },
    });
    const a = document.createElement('a');
    a.download = opts.fileName;
    a.href = dataUrl;
    a.click();
  } finally {
    container.classList.remove('exporting');
    if (previousTheme) root.dataset.theme = previousTheme;
  }
}
