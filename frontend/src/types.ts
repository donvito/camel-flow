// Mirrors io.camelviewer.model.Graph (served at /api/graph).

export type Category =
  | 'ai'
  | 'messaging'
  | 'database'
  | 'http'
  | 'file'
  | 'email'
  | 'saas'
  | 'cloud'
  | 'scheduler'
  | 'internal'
  | 'other'
  | 'unresolved'
  | 'dynamic'
  | 'eip';

export interface FileStatus {
  path: string;
  routes: number;
  error?: string;
  uploaded: boolean;
  ignored?: string[];
}

export interface Trigger {
  label: string;
  category: Category;
  uri: string;
  scheme: string;
}

export interface StepSummary {
  label: string;
  category: Category;
}

export interface Branch {
  label?: string;
  expression?: string;
  steps?: StepNode[];
}

export interface StepNode {
  kind: string;
  label?: string;
  id?: string;
  description?: string;
  note?: string;
  uri?: string;
  parameters?: Record<string, unknown>;
  expression?: string;
  category?: Category;
  scheme?: string;
  system?: string;
  dynamic?: boolean;
  disabled?: boolean;
  internal?: boolean;
  linkKey?: string;
  branches?: Branch[];
  children?: StepNode[];
}

export interface Route {
  id: string;
  routeId: string;
  title: string;
  description?: string;
  note?: string;
  file: string;
  template: boolean;
  kind: string;
  trigger?: Trigger;
  steps: StepSummary[];
  systemCount: number;
  categoryCounts: Record<string, number>;
  fromUri?: string;
  produces: string[];
  consumes: string[];
  lines: [number, number];
  yaml?: string;
  stepTree: StepNode;
  stepCount: number;
  warnings: string[];
}

export interface SystemNode {
  id: string;
  label: string;
  detail?: string;
  category: Category;
  scheme: string;
  uris: string[];
  internal: boolean;
  dynamic: boolean;
}

export interface Api {
  id: string;
  method: string;
  path: string;
  description?: string;
  file: string;
  toUri?: string;
}

export type LinkKind = 'call' | 'async' | 'event' | 'uses' | 'triggers' | 'api';

export interface Link {
  id: string;
  source: string;
  target: string;
  kind: LinkKind;
  label?: string;
  linkKey?: string;
}

export interface Graph {
  generatedAt: string;
  rootDir: string;
  files: FileStatus[];
  routes: Route[];
  systems: SystemNode[];
  apis: Api[];
  links: Link[];
  warnings: string[];
}

export interface Config {
  defaultView: ViewMode;
  rootDir: string;
  version: string;
}

export type ViewMode = 'executive' | 'technical';
export type Direction = 'LR' | 'TB';
export type ThemeChoice = 'system' | 'light' | 'dark';
