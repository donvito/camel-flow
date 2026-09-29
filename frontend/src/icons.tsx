import {
  ArrowRightLeft,
  Box,
  Braces,
  CircleAlert,
  Clock,
  Cloud,
  Database,
  Filter,
  FolderOpen,
  GitBranch,
  Globe,
  Layers,
  Mail,
  MessageSquare,
  Radio,
  Repeat,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Split,
  Merge,
  Timer,
  Webhook,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from './types';

export const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI',
  messaging: 'Messaging',
  database: 'Database',
  http: 'API / HTTP',
  file: 'Files & storage',
  email: 'Email',
  saas: 'Apps',
  cloud: 'Cloud',
  scheduler: 'Schedule',
  internal: 'Internal',
  other: 'Other',
  unresolved: 'Missing route',
  dynamic: 'Dynamic',
  eip: 'Step',
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  ai: Sparkles,
  messaging: Radio,
  database: Database,
  http: Globe,
  file: FolderOpen,
  email: Mail,
  saas: MessageSquare,
  cloud: Cloud,
  scheduler: Clock,
  internal: ArrowRightLeft,
  other: Box,
  unresolved: CircleAlert,
  dynamic: Shuffle,
  eip: Braces,
};

const STEP_ICONS: Record<string, LucideIcon> = {
  choice: GitBranch,
  filter: Filter,
  split: Split,
  aggregate: Merge,
  multicast: Split,
  loop: Repeat,
  doTry: ShieldCheck,
  circuitBreaker: ShieldCheck,
  delay: Timer,
  throttle: Timer,
  recipientList: Shuffle,
  routingSlip: Shuffle,
  dynamicRouter: Shuffle,
  loadBalance: Layers,
  transform: Zap,
  setBody: Zap,
  marshal: Braces,
  unmarshal: Braces,
};

export function CategoryIcon({ category, size = 16 }: { category?: Category | string; size?: number }) {
  const Icon = CATEGORY_ICONS[category ?? 'other'] ?? Box;
  return <Icon size={size} strokeWidth={2} aria-hidden />;
}

export function StepIcon({ kind, category, size = 15 }: { kind: string; category?: string; size?: number }) {
  if (category && category !== 'eip') return <CategoryIcon category={category} size={size} />;
  const Icon = STEP_ICONS[kind] ?? Braces;
  return <Icon size={size} strokeWidth={2} aria-hidden />;
}

export function TriggerIcon({ category, size = 14 }: { category?: string; size?: number }) {
  if (category === 'http') return <Webhook size={size} aria-hidden />;
  return <CategoryIcon category={category} size={size} />;
}
