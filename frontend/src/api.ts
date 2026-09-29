import { useCallback, useEffect, useRef, useState } from 'react';
import type { Config, Graph } from './types';

export async function fetchConfig(): Promise<Config> {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error(`config: HTTP ${res.status}`);
  return res.json();
}

async function fetchGraph(): Promise<Graph> {
  const res = await fetch('/api/graph');
  if (!res.ok) throw new Error(`graph: HTTP ${res.status}`);
  return res.json();
}

export async function uploadFile(file: File): Promise<void> {
  const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    body: await file.text(),
    headers: { 'Content-Type': 'text/yaml' },
  });
  if (!res.ok) throw new Error(`upload failed: HTTP ${res.status}`);
}

/** Closes one file that was opened or dropped in the browser. */
export async function closeFile(path: string): Promise<void> {
  const res = await fetch(`/api/upload?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`close failed: HTTP ${res.status}`);
}

export async function clearUploads(): Promise<void> {
  await fetch('/api/upload', { method: 'DELETE' });
}

/** Loads the graph and refetches whenever the server reports a file change (SSE). */
export function useGraph() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const [connected, setConnected] = useState(true);
  const first = useRef(true);

  const reload = useCallback(async () => {
    try {
      const g = await fetchGraph();
      setGraph(g);
      setError(null);
      if (!first.current) setUpdatedAt(Date.now());
      first.current = false;
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    reload();
    const es = new EventSource('/api/events');
    es.addEventListener('changed', () => reload());
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [reload]);

  return { graph, error, updatedAt, connected, reload };
}
