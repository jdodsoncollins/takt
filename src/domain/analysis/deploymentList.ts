import type { VercelDeploymentSummary } from '../models/vercelModels';
import { isFailedState, isInFlightState } from './projectHealth';

export type DeploymentListFilter = 'all' | 'failed' | 'building' | 'production';

export const DEPLOYMENT_LIST_FILTERS: {
  key: DeploymentListFilter;
  label: string;
}[] = [
  { key: 'all', label: 'All' },
  { key: 'failed', label: 'Failed' },
  { key: 'building', label: 'Building' },
  { key: 'production', label: 'Production' },
];

export function filterDeployments(
  deployments: VercelDeploymentSummary[],
  filter: DeploymentListFilter,
): VercelDeploymentSummary[] {
  switch (filter) {
    case 'failed':
      return deployments.filter((d) => isFailedState(d.state));
    case 'building':
      return deployments.filter((d) => isInFlightState(d.state));
    case 'production':
      return deployments.filter((d) => d.target === 'production');
    default:
      return deployments;
  }
}

export function deploymentTitle(d: VercelDeploymentSummary): string {
  const message = commitSubject(d.meta.githubCommitMessage);
  if (message) return message.slice(0, 72);
  return shortCommitSha(d.meta.githubCommitSha) ?? d.id.slice(0, 12);
}

export function shortCommitSha(
  sha: string | null | undefined,
): string | null {
  if (!sha || sha.length < 7) return null;
  return sha.slice(0, 7);
}

export function commitSubject(
  message: string | null | undefined,
): string | null {
  if (!message) return null;
  const line = message.trim().split('\n')[0]?.trim() ?? '';
  return line || null;
}

export function commitBody(message: string | null | undefined): string | null {
  if (!message) return null;
  const rest = message.trim().split('\n').slice(1).join('\n').trim();
  return rest || null;
}

/** List row: production · master · 5571c7e · 2m ago */
export function deploymentListMetaLine(
  d: VercelDeploymentSummary,
  now = Date.now(),
): string {
  return [
    d.target ?? 'no target',
    d.meta.githubCommitRef,
    shortCommitSha(d.meta.githubCommitSha),
    formatRelativeTime(d.createdAt, now),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Detail: master · 5571c7e · 32s */
export function deploymentRefLine(d: VercelDeploymentSummary): string {
  const build =
    d.buildDurationMs != null
      ? `${Math.round(d.buildDurationMs / 1000)}s`
      : null;
  const parts = [
    d.meta.githubCommitRef,
    shortCommitSha(d.meta.githubCommitSha),
    build,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'unknown branch';
}

/** Detail: git · @login · region — never an email. */
export function deploymentProvenanceLine(
  d: VercelDeploymentSummary,
): string | null {
  const login = d.meta.githubCommitAuthorLogin?.replace(/^@/, '').trim();
  const named = d.meta.githubCommitAuthorName?.trim();
  const creator = d.creatorUsername?.replace(/^@/, '').trim();
  const actor = login
    ? `@${login}`
    : named || (creator ? `@${creator}` : null);
  const parts = [d.source, actor, d.region].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function formatRelativeTime(ms: number, now = Date.now()): string {
  const delta = now - ms;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  if (delta < 7 * 86_400_000) return `${Math.floor(delta / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString();
}

export function countDeploymentsByFilter(
  deployments: VercelDeploymentSummary[],
): Record<DeploymentListFilter, number> {
  return {
    all: deployments.length,
    failed: deployments.filter((d) => isFailedState(d.state)).length,
    building: deployments.filter((d) => isInFlightState(d.state)).length,
    production: deployments.filter((d) => d.target === 'production').length,
  };
}
