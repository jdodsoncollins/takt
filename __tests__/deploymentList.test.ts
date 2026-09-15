import { describe, expect, it } from 'vitest';
import {
  commitBody,
  countDeploymentsByFilter,
  deploymentListMetaLine,
  deploymentProvenanceLine,
  deploymentRefLine,
  deploymentTitle,
  filterDeployments,
  formatRelativeTime,
  shortCommitSha,
} from '../src/domain/analysis/deploymentList';
import { deploymentID } from '../src/domain/models/ids';
import type { VercelDeploymentSummary } from '../src/domain/models/vercelModels';

function dep(
  id: string,
  state: VercelDeploymentSummary['state'],
  target: VercelDeploymentSummary['target'],
  createdAt = Date.now(),
  message?: string,
): VercelDeploymentSummary {
  return {
    id: deploymentID(id),
    url: `https://example-${id}.vercel.app`,
    name: 'app',
    state,
    target,
    createdAt,
    readyAt: null,
    buildingAt: null,
    source: null,
    meta: { githubCommitMessage: message ?? null, githubCommitSha: 'abcdef123' },
    inspectorUrl: null,
  };
}

describe('deploymentList', () => {
  const list = [
    dep('a', 'READY', 'production', 3, 'feat: ship\n\nbody'),
    dep('b', 'ERROR', 'production', 2, 'fix: oauth'),
    dep('c', 'BUILDING', 'preview', 1),
  ];

  it('filters failed / building / production', () => {
    expect(filterDeployments(list, 'failed').map((d) => d.id)).toEqual(['b']);
    expect(filterDeployments(list, 'building').map((d) => d.id)).toEqual(['c']);
    expect(filterDeployments(list, 'production').map((d) => d.id)).toEqual([
      'a',
      'b',
    ]);
    expect(countDeploymentsByFilter(list).failed).toBe(1);
  });

  it('uses the first line of the commit message as the title', () => {
    expect(deploymentTitle(list[0])).toBe('feat: ship');
    expect(commitBody(list[0]?.meta.githubCommitMessage)).toBe('body');
    expect(shortCommitSha('5571c7e9aedabbd14da0111bc399ddcf077d18a2')).toBe(
      '5571c7e',
    );
  });

  it('builds list and detail meta from git fields without inventing them', () => {
    const d: VercelDeploymentSummary = {
      ...dep('a', 'READY', 'production', 1_000_000, 'feat: ship\n\nbody'),
      source: 'git',
      creatorUsername: 'jane',
      region: 'iad1',
      buildDurationMs: 32_000,
      meta: {
        githubCommitRef: 'master',
        githubCommitSha: '5571c7e9aedabbd14da0111bc399ddcf077d18a2',
        githubCommitMessage: 'feat: ship\n\nbody',
        githubCommitAuthorLogin: 'jane',
      },
    };
    expect(deploymentListMetaLine(d, 1_000_000 + 120_000)).toBe(
      'production · master · 5571c7e · 2m ago',
    );
    expect(deploymentRefLine(d)).toBe('master · 5571c7e · 32s');
    expect(deploymentProvenanceLine(d)).toBe('git · @jane · iad1');
  });

  it('formats relative time', () => {
    const now = 1_000_000;
    expect(formatRelativeTime(now - 30_000, now)).toBe('just now');
    expect(formatRelativeTime(now - 120_000, now)).toBe('2m ago');
  });
});
