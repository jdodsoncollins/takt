import { describe, expect, it } from 'vitest';
import {
  formatCompactAge,
  rankSites,
  siteClearWord,
  siteCommitLine,
  siteMetaLine,
  siteRepoLabel,
  siteStampAge,
  siteStampGit,
  siteStampProd,
  siteSubtitle,
  siteTitle,
} from '../src/domain/models/siteScope';
import { deploymentID, projectID } from '../src/domain/models/ids';
import type { VercelProject } from '../src/domain/models/vercelModels';

function project(
  partial: Omit<Partial<VercelProject>, 'id'> & { id: string; name: string },
): VercelProject {
  const { id, ...rest } = partial;
  return {
    framework: null,
    nodeVersion: null,
    primaryDomain: null,
    productionDeployment: null,
    latestDeployment: null,
    lastSuccessfulDeployment: null,
    latestFailedDeployment: null,
    needsAttention: false,
    attentionReason: 'none',
    teamId: null,
    ...rest,
    id: projectID(id),
    name: partial.name,
  };
}

describe('siteScope', () => {
  it('prefers the production host as the site title', () => {
    const shop = project({
      id: 'p1',
      name: 'shop-web',
      primaryDomain: 'https://shop.example.com',
    });
    expect(siteTitle(shop)).toBe('shop.example.com');
    expect(siteSubtitle(shop)).toBe('shop-web');
  });

  it('falls back to the project name when no domain is known', () => {
    const p = project({ id: 'p2', name: 'internal-api' });
    expect(siteTitle(p)).toBe('internal-api');
  });

  it('ranks attention first, then title, and filters by query', () => {
    const a = project({
      id: 'a',
      name: 'alpha',
      primaryDomain: 'alpha.example.com',
    });
    const b = project({
      id: 'b',
      name: 'bravo',
      primaryDomain: 'bravo.example.com',
      needsAttention: true,
      attentionReason: 'recent_failure',
    });
    const c = project({ id: 'c', name: 'other', primaryDomain: 'z.example.com' });
    expect(rankSites([a, b, c]).map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(rankSites([a, b, c], 'brav').map((p) => p.name)).toEqual(['bravo']);
  });

  it('builds repo, meta, and commit lines for richer site rows', () => {
    const pinest = project({
      id: 'widgets',
      name: 'widgets',
      primaryDomain: 'www.example.com',
      link: { type: 'github', org: 'acme', repo: 'widgets' },
      productionDeployment: {
        id: deploymentID('dpl_1'),
        url: 'https://widgets.vercel.app',
        name: 'widgets',
        state: 'READY',
        target: 'production',
        createdAt: Date.UTC(2026, 7, 27),
        readyAt: Date.UTC(2026, 7, 27),
        buildingAt: null,
        source: 'git',
        meta: {
          githubCommitRef: 'master',
          githubCommitSha: '5571c7e9aedabbd14da0111bc399ddcf077d18a2',
          githubCommitMessage: 'refine hero and section headings\n\nmore',
        },
        inspectorUrl: null,
      },
    });
    expect(siteRepoLabel(pinest)).toBe('acme/widgets');
    expect(siteMetaLine(pinest)).toBe('acme/widgets');
    expect(siteCommitLine(pinest)).toMatch(
      /refine hero and section headings · 5571c7e · 27 Aug 2026/,
    );
    expect(rankSites([pinest], 'example').map((p) => p.name)).toEqual([
      'widgets',
    ]);
  });

  it('stamps prod, git, and compact age for the Home rack', () => {
    const now = Date.UTC(2026, 8, 8, 12, 0, 0);
    const shop = project({
      id: 'p1',
      name: 'shop-web',
      primaryDomain: 'shop.example.com',
      productionDeployment: {
        id: deploymentID('dpl_2'),
        url: 'https://shop.example.com',
        name: 'shop-web',
        state: 'READY',
        target: 'production',
        createdAt: now - 12 * 60_000,
        readyAt: now - 12 * 60_000,
        buildingAt: null,
        source: 'git',
        meta: {
          githubCommitRef: 'main',
          githubCommitSha: '7f3a21cabcdef',
        },
        inspectorUrl: null,
      },
    });
    expect(siteStampProd(shop)).toBe('main');
    expect(siteStampGit(shop)).toBe('7f3a21c');
    expect(formatCompactAge(now - 12 * 60_000, now)).toBe('12m');
    expect(siteStampAge(shop, now)).toEqual({ label: '12m', fill: 12 / (24 * 60) });
    expect(siteClearWord(shop).label).toBe('ALL CLEAR');
  });

  it('uses NONE and a zero fill when there is no production deploy', () => {
    const empty = project({ id: 'p2', name: 'empty' });
    expect(siteStampProd(empty)).toBe('NONE');
    expect(siteStampGit(empty)).toBe('NONE');
    expect(siteStampAge(empty).label).toBe('NONE');
    expect(siteStampAge(empty).fill).toBe(0);
    expect(siteClearWord({ ...empty, needsAttention: true, attentionReason: 'no_production' }).label).toBe(
      'NO PROD',
    );
  });
});
