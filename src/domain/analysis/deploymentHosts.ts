import type { DataAvailability } from '../models/vercelModels';

export type DeploymentHostKind =
  | 'production'
  | 'alias'
  | 'branch'
  | 'commit'
  | 'other';

export interface ClassifiedHost {
  host: string;
  kind: DeploymentHostKind;
}

export interface DeploymentHostsContext {
  projectName: string;
  teamSlug?: string | null;
  commitSha?: string | null;
  deploymentId?: string | null;
  branch?: string | null;
  productionDomains?: Array<string | null | undefined> | null;
  deploymentUrl?: string | null;
}

export interface DeploymentHostsReport {
  production: ClassifiedHost[];
  aliases: ClassifiedHost[];
  branch: ClassifiedHost[];
  commit: ClassifiedHost[];
  other: ClassifiedHost[];
  availability: DataAvailability;
  assignedCount: number;
  note?: string;
}

const VERCEL_APP = /\.vercel\.app$/i;

export function normalizeHost(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')
    .toLowerCase();
}

export function classifyDeploymentHosts(
  aliases: Array<string | null | undefined> | null | undefined,
  ctx: DeploymentHostsContext,
): DeploymentHostsReport {
  const hosts = uniqueHosts([
    ...(aliases ?? []),
    ctx.deploymentUrl,
  ]);
  if (hosts.length === 0) {
    return emptyReport('no_data', 'No hosts assigned to this deployment.');
  }

  const productionSet = new Set(
    (ctx.productionDomains ?? [])
      .map((d) => normalizeHost(d))
      .filter((d): d is string => typeof d === 'string' && !VERCEL_APP.test(d)),
  );
  const deployHost = normalizeHost(ctx.deploymentUrl);
  const sha = ctx.commitSha?.trim().toLowerCase() ?? '';
  const shaToken = sha.length >= 7 ? sha.slice(0, 8) : '';
  const shortId = shortDeploymentToken(ctx.deploymentId, deployHost);

  const buckets: Record<DeploymentHostKind, ClassifiedHost[]> = {
    production: [],
    alias: [],
    branch: [],
    commit: [],
    other: [],
  };

  for (const host of hosts) {
    const kind = classifyOne(host, {
      productionSet,
      deployHost,
      shaToken,
      shortId,
      branch: ctx.branch,
    });
    buckets[kind].push({ host, kind });
  }

  return {
    production: buckets.production,
    aliases: buckets.alias,
    branch: buckets.branch,
    commit: buckets.commit,
    other: buckets.other,
    availability: 'ok',
    assignedCount: hosts.length,
  };
}

export function hostHref(host: string): string {
  return host.startsWith('http') ? host : `https://${host}`;
}

export function hostKindLabel(kind: DeploymentHostKind): string {
  switch (kind) {
    case 'production':
      return 'Production';
    case 'alias':
      return 'Aliases';
    case 'branch':
      return 'Branch';
    case 'commit':
      return 'Commit';
    case 'other':
      return 'Other';
  }
}

export function hostsSummary(report: DeploymentHostsReport): string {
  if (report.availability !== 'ok') {
    return report.note ?? 'No hosts assigned';
  }
  return `${report.assignedCount} assigned`;
}

function classifyOne(
  host: string,
  ctx: {
    productionSet: Set<string>;
    deployHost: string | null;
    shaToken: string;
    shortId: string | null;
    branch?: string | null;
  },
): DeploymentHostKind {
  if (ctx.productionSet.has(host) || !VERCEL_APP.test(host)) {
    return 'production';
  }
  if (ctx.deployHost && host === ctx.deployHost) return 'commit';
  if (ctx.shortId && hostIncludesToken(host, ctx.shortId)) return 'commit';
  if (ctx.shaToken && hostIncludesToken(host, ctx.shaToken)) return 'commit';
  if (isBranchAlias(host, ctx.branch)) return 'branch';
  if (VERCEL_APP.test(host)) return 'alias';
  return 'other';
}

function isBranchAlias(host: string, branch?: string | null): boolean {
  if (!VERCEL_APP.test(host)) return false;
  if (/-git-/.test(host)) return true;
  const slug = branch?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if (slug && host.includes(`-git-${slug}-`)) return true;
  return false;
}

function hostIncludesToken(host: string, token: string): boolean {
  const t = token.toLowerCase();
  if (t.length < 7) return false;
  return host.includes(`-${t}-`) || host.includes(`-${t}.`);
}

function shortDeploymentToken(
  deploymentId?: string | null,
  deployHost?: string | null,
): string | null {
  if (deployHost) {
    const labels = deployHost.replace(VERCEL_APP, '').split('-');
    const candidate = labels.find((p) => /^[a-z0-9]{7,12}$/i.test(p) && /\d/.test(p));
    if (candidate) return candidate.toLowerCase();
  }
  const id = deploymentId?.trim() ?? '';
  if (!id) return null;
  const stripped = id.replace(/^dpl_/i, '');
  return stripped.length >= 7 ? stripped.slice(0, 8).toLowerCase() : null;
}

function uniqueHosts(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const host = normalizeHost(value);
    if (!host || seen.has(host)) continue;
    seen.add(host);
    out.push(host);
  }
  return out;
}

function emptyReport(
  availability: DataAvailability,
  note: string,
): DeploymentHostsReport {
  return {
    production: [],
    aliases: [],
    branch: [],
    commit: [],
    other: [],
    availability,
    assignedCount: 0,
    note,
  };
}
