export type OpsCommandId =
  | 'issues'
  | 'incident'
  | 'env'
  | 'domain'
  | 'compare'
  | 'firewall'
  | 'flags'
  | 'runtime'
  | 'logs'
  | 'deploys'
  | 'projects'
  | 'activity'
  | 'settings'
  | 'unknown';

export type OpsCommand = {
  id: Exclude<OpsCommandId, 'unknown'>;
  label: string;
  example: string;
  keywords: string[];
  /** Shown in the idle chip row. Searchable commands may omit this. */
  suggest?: boolean;
};

export const OPS_COMMAND_CATALOG: OpsCommand[] = [
  {
    id: 'issues',
    label: 'Diagnose',
    example: 'diagnose',
    suggest: true,
    keywords: [
      'diagnose',
      'check',
      'issues',
      'issue',
      'brief',
      'health',
      'status',
      'attention',
      'problem',
    ],
  },
  {
    id: 'incident',
    label: 'Why did this fail?',
    example: 'why did this fail',
    suggest: true,
    keywords: [
      'fail',
      'failed',
      'failure',
      'why',
      'diagnose',
      'incident',
      'broken',
      'error',
    ],
  },
  {
    id: 'deploys',
    label: 'Deployments',
    example: 'deployments',
    suggest: true,
    keywords: [
      'deploy',
      'deploys',
      'deployment',
      'deployments',
      'ship',
      'release',
      'promote',
      'rollback',
      'redeploy',
    ],
  },
  {
    id: 'env',
    label: 'Env drift',
    example: 'env drift',
    suggest: true,
    keywords: ['env', 'environment', 'drift', 'variable', 'variables', 'secret'],
  },
  {
    id: 'domain',
    label: 'Domain / DNS / SSL',
    example: 'domain status',
    suggest: true,
    keywords: ['domain', 'dns', 'ssl', 'tls', 'cert', 'certificate'],
  },
  {
    id: 'compare',
    label: 'What changed?',
    example: 'what changed',
    suggest: true,
    keywords: ['changed', 'compare', 'diff', 'delta', 'commit'],
  },
  {
    id: 'firewall',
    label: 'Firewall',
    example: 'firewall',
    suggest: true,
    keywords: ['firewall', 'waf', 'denied', 'blocked'],
  },
  {
    id: 'flags',
    label: 'Feature flags',
    example: 'flags',
    suggest: true,
    keywords: ['flag', 'flags', 'feature'],
  },
  {
    id: 'runtime',
    label: 'Production 5xx',
    example: 'production 5xx since this morning',
    suggest: true,
    keywords: ['runtime', '5xx', '500', 'production', 'errors'],
  },
  {
    id: 'logs',
    label: 'Build logs',
    example: 'build logs',
    suggest: true,
    keywords: ['log', 'logs', 'build', 'output'],
  },
  {
    id: 'projects',
    label: 'Projects',
    example: 'projects',
    keywords: ['project', 'projects', 'home', 'list'],
  },
  {
    id: 'activity',
    label: 'Activity',
    example: 'activity',
    keywords: ['activity', 'audit', 'history', 'events'],
  },
  {
    id: 'settings',
    label: 'Settings',
    example: 'settings',
    keywords: ['settings', 'token', 'connect', 'login', 'account'],
  },
];

export const OPS_COMMAND_SUGGESTIONS = OPS_COMMAND_CATALOG.filter(
  (c) => c.suggest,
);

function tokensOf(raw: string): string[] {
  return raw
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

export function scoreOpsCommand(query: string, cmd: OpsCommand): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const tokens = tokensOf(q);
  if (tokens.length === 0) return 0;
  const keys = cmd.keywords.map((k) => k.toLowerCase());
  const hay = [cmd.id, cmd.label, cmd.example, ...keys].join(' ').toLowerCase();
  let score = 0;
  if (cmd.example === q || cmd.label.toLowerCase() === q) score += 80;
  for (const t of tokens) {
    let best = 0;
    for (const k of keys) {
      if (k === t) best = Math.max(best, 50);
      else if (k.startsWith(t) && t.length >= 3) best = Math.max(best, 45);
      else if (t.startsWith(k) && k.length >= 3) best = Math.max(best, 35);
      else if (k.includes(t) && t.length >= 4) best = Math.max(best, 20);
    }
    if (hay.includes(t)) best = Math.max(best, 20);
    score += best;
  }
  return score;
}

const MATCH_FLOOR = 40;

export function rankOpsCommands(query: string): OpsCommand[] {
  const ranked: { cmd: OpsCommand; score: number }[] = [];
  for (const cmd of OPS_COMMAND_CATALOG) {
    const score = scoreOpsCommand(query, cmd);
    if (score >= MATCH_FLOOR) ranked.push({ cmd, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.map((row) => row.cmd);
}

export function matchOpsCommand(raw: string): OpsCommandId {
  const ranked = rankOpsCommands(raw);
  return ranked[0]?.id ?? 'unknown';
}
