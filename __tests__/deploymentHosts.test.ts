import { describe, expect, it } from 'vitest';
import {
  classifyDeploymentHosts,
  hostKindLabel,
  hostsSummary,
  normalizeHost,
} from '../src/domain/analysis/deploymentHosts';

const EXAMPLE_ALIASES = [
  'www.example.com',
  'example.com',
  'example-app.vercel.app',
  'example-app-acme-projects.vercel.app',
  'example-app-git-master-acme-projects.vercel.app',
  'example-app-2r19igjya-acme-projects.vercel.app',
];

describe('classifyDeploymentHosts', () => {
  it('groups production, alias, branch, and commit hosts', () => {
    const report = classifyDeploymentHosts(EXAMPLE_ALIASES, {
      projectName: 'example-app',
      teamSlug: 'acme-projects',
      branch: 'master',
      commitSha: '779f822abc',
      deploymentId: 'dpl_example',
      deploymentUrl: 'example-app-2r19igjya-acme-projects.vercel.app',
      productionDomains: ['www.example.com', 'example.com'],
    });

    expect(report.availability).toBe('ok');
    expect(report.assignedCount).toBe(6);
    expect(report.production.map((h) => h.host)).toEqual([
      'www.example.com',
      'example.com',
    ]);
    expect(report.aliases.map((h) => h.host)).toEqual([
      'example-app.vercel.app',
      'example-app-acme-projects.vercel.app',
    ]);
    expect(report.branch.map((h) => h.host)).toEqual([
      'example-app-git-master-acme-projects.vercel.app',
    ]);
    expect(report.commit.map((h) => h.host)).toEqual([
      'example-app-2r19igjya-acme-projects.vercel.app',
    ]);
  });

  it('treats non-vercel.app hosts as production even without a domain list', () => {
    const report = classifyDeploymentHosts(['shop.example.com'], {
      projectName: 'shop',
    });
    expect(report.production[0]?.host).toBe('shop.example.com');
  });

  it('reports no_data when nothing is assigned', () => {
    const report = classifyDeploymentHosts([], { projectName: 'empty' });
    expect(report.availability).toBe('no_data');
    expect(report.assignedCount).toBe(0);
    expect(report.note).toMatch(/No hosts assigned/i);
  });

  it('dedupes protocol-prefixed aliases against the deployment URL', () => {
    const report = classifyDeploymentHosts(
      ['https://www.example.com/'],
      {
        projectName: 'ex',
        deploymentUrl: 'https://www.example.com',
        productionDomains: ['www.example.com'],
      },
    );
    expect(report.assignedCount).toBe(1);
    expect(report.production).toHaveLength(1);
  });

  it('does not treat a vercel.app project URL as production', () => {
    const report = classifyDeploymentHosts(
      ['shop-2r19igjya-team.vercel.app'],
      {
        projectName: 'shop',
        deploymentUrl: 'shop-2r19igjya-team.vercel.app',
        productionDomains: ['https://shop-2r19igjya-team.vercel.app'],
      },
    );
    expect(report.production).toHaveLength(0);
    expect(report.commit.map((h) => h.host)).toEqual([
      'shop-2r19igjya-team.vercel.app',
    ]);
  });
});

describe('normalizeHost', () => {
  it('strips protocol and path', () => {
    expect(normalizeHost('https://WWW.Example.com/foo')).toBe('www.example.com');
  });
});

describe('host labels', () => {
  it('summarizes assigned vs empty hosts', () => {
    expect(hostKindLabel('production')).toBe('Production');
    expect(hostKindLabel('alias')).toBe('Aliases');
    const empty = classifyDeploymentHosts([], { projectName: 'empty' });
    expect(hostsSummary(empty)).toMatch(/No hosts assigned/i);
    const one = classifyDeploymentHosts(['shop.example.com'], {
      projectName: 'shop',
    });
    expect(hostsSummary(one)).toBe('1 assigned');
  });
});
