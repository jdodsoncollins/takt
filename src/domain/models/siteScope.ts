import type { VercelProject } from './vercelModels';

/** Display label for a site (selected project). Prefer the live host. */
export function siteTitle(project: VercelProject): string {
  const host = hostOf(project.primaryDomain);
  return host || project.name;
}

export function siteSubtitle(project: VercelProject): string {
  const host = hostOf(project.primaryDomain);
  if (host && host !== project.name) return project.name;
  return [project.framework, project.productionDeployment?.state]
    .filter(Boolean)
    .join(' · ');
}

/** `org/repo` when the Vercel project is linked to Git. */
export function siteRepoLabel(project: VercelProject): string | null {
  const org = project.link?.org?.trim();
  const repo = project.link?.repo?.trim();
  if (org && repo) return `${org}/${repo}`;
  if (repo) return repo;
  return null;
}

export function siteHostLabel(project: VercelProject): string | null {
  return hostOf(project.primaryDomain);
}

/** Domain · repo, omitting empties and avoiding duplicating the title. */
export function siteMetaLine(project: VercelProject): string | null {
  const title = siteTitle(project);
  const parts = [siteHostLabel(project), siteRepoLabel(project)].filter(
    (part): part is string => Boolean(part) && part !== title,
  );
  return parts.length ? parts.join(' · ') : null;
}

/** Production (or latest) commit subject · date. */
export function siteCommitLine(project: VercelProject): string | null {
  const deploy =
    project.productionDeployment ?? project.latestDeployment ?? null;
  if (!deploy) return null;
  const subject = firstLine(deploy.meta.githubCommitMessage);
  const sha =
    deploy.meta.githubCommitSha && deploy.meta.githubCommitSha.length >= 7
      ? deploy.meta.githubCommitSha.slice(0, 7)
      : null;
  const when = formatShortDate(deploy.createdAt);
  const parts = [subject, sha, when].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function firstLine(message: string | null | undefined): string | null {
  if (!message) return null;
  const line = message.trim().split('\n')[0]?.trim() ?? '';
  if (!line) return null;
  return line.length > 52 ? `${line.slice(0, 51).trimEnd()}…` : line;
}

function formatShortDate(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return null;
  }
}

/** Branch or target for the Home stamp. Never a bare dash. */
export function siteStampProd(project: VercelProject): string {
  const deploy =
    project.productionDeployment ?? project.latestDeployment ?? null;
  const ref = deploy?.meta.githubCommitRef?.trim();
  if (ref) return ref;
  if (deploy?.target) return deploy.target;
  return 'NONE';
}

/** Short SHA for the Home stamp. */
export function siteStampGit(project: VercelProject): string {
  const deploy =
    project.productionDeployment ?? project.latestDeployment ?? null;
  const sha = deploy?.meta.githubCommitSha;
  if (sha && sha.length >= 7) return sha.slice(0, 7);
  return 'NONE';
}

/** Compact age (`12m`, `3h`, `now`). `fill` is 0–1 over a 24-hour metronome. */
export function formatCompactAge(createdAt: number, now = Date.now()): string {
  const delta = Math.max(0, now - createdAt);
  if (delta < 60_000) return 'now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h`;
  return `${Math.floor(delta / 86_400_000)}d`;
}

export function siteStampAge(
  project: VercelProject,
  now = Date.now(),
): { label: string; fill: number } {
  const deploy =
    project.productionDeployment ?? project.latestDeployment ?? null;
  if (!deploy) return { label: 'NONE', fill: 0 };
  const minutes = Math.max(0, now - deploy.createdAt) / 60_000;
  return {
    label: formatCompactAge(deploy.createdAt, now),
    fill: Math.min(1, minutes / (24 * 60)),
  };
}

export function siteClearWord(project: VercelProject): {
  label: string;
  tone: 'ready' | 'building' | 'error' | 'neutral';
} {
  if (!project.needsAttention) return { label: 'ALL CLEAR', tone: 'ready' };
  if (project.attentionReason === 'latest_production_failed') {
    return { label: 'CRITICAL', tone: 'error' };
  }
  if (project.attentionReason === 'building') {
    return { label: 'BUILDING', tone: 'building' };
  }
  if (project.attentionReason === 'no_production') {
    return { label: 'NO PROD', tone: 'neutral' };
  }
  return { label: 'ATTENTION', tone: 'building' };
}

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^https?:\/\//i, '').replace(/\/.*$/, '') || null;
}

export function rankSites(
  projects: VercelProject[],
  query = '',
): VercelProject[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? projects.filter((p) => {
        const hay = [
          p.name,
          p.primaryDomain,
          siteTitle(p),
          siteRepoLabel(p),
          p.framework,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
    : [...projects];
  return filtered.sort((a, b) => {
    const attention = Number(b.needsAttention) - Number(a.needsAttention);
    if (attention !== 0) return attention;
    return siteTitle(a).localeCompare(siteTitle(b));
  });
}
