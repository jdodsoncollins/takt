import { describe, expect, it } from 'vitest';
import {
  deploymentListMetaLine,
  deploymentTitle,
} from '../src/domain/analysis/deploymentList';
import {
  siteCommitLine,
  siteMetaLine,
  siteRepoLabel,
  siteTitle,
} from '../src/domain/models/siteScope';
import { DemoVercelAPIClient } from '../src/services/api/demoAPIClient';
import {
  DEMO_PROJECT_ID,
  DEMO_USER,
  buildDemoActivity,
  buildDemoConnection,
  buildDemoDeployments,
  buildDemoProjects,
  demoHasIdentifyingCopy,
} from '../src/support/demoFixtures';
import { demoModeEnabled, isDemoMode } from '../src/support/demoMode';

describe('demoModeEnabled', () => {
  it('is off unless the env value is an explicit yes', () => {
    expect(demoModeEnabled(undefined)).toBe(false);
    expect(demoModeEnabled('')).toBe(false);
    expect(demoModeEnabled('0')).toBe(false);
    expect(demoModeEnabled('1')).toBe(true);
    expect(demoModeEnabled('true')).toBe(true);
    expect(demoModeEnabled('YES')).toBe(true);
  });

  it('is off in this test process (env unset)', () => {
    expect(isDemoMode).toBe(false);
  });
});

describe('demo fixtures', () => {
  const now = Date.UTC(2026, 8, 6, 16, 41, 0);
  const projects = buildDemoProjects(now);
  const deploys = buildDemoDeployments(DEMO_PROJECT_ID.portfolio, now);

  it('uses generic project names, domains, and repos', () => {
    expect(projects.map((p) => siteTitle(p))).toEqual([
      'example-portfolio.app',
      'example-store.app',
      'example-docs.app',
      'example-blog.app',
    ]);
    expect(projects.map((p) => siteRepoLabel(p))).toEqual([
      'example/portfolio',
      'example/store',
      'example/docs',
      'example/blog',
    ]);
    for (const project of projects) {
      expect(demoHasIdentifyingCopy(JSON.stringify(project))).toBe(false);
      expect(siteMetaLine(project)).toContain('example/');
      expect(siteCommitLine(project)).toMatch(/ · [0-9a-f]{7} · /);
    }
  });

  it('uses generic commit subjects and never emails or live URLs', () => {
    expect(DEMO_USER.email).toBeNull();
    expect(deploys.length).toBeGreaterThan(10);
    expect(deploys.some((d) => d.state === 'ERROR')).toBe(true);
    expect(deploys.filter((d) => d.target === 'production' && d.state === 'ERROR')).toHaveLength(
      0,
    );
    for (const row of deploys) {
      expect(row.url).toBeNull();
      expect(row.meta.githubCommitAuthorLogin).toBe('example');
      expect(deploymentTitle(row)).not.toMatch(/@/);
      expect(demoHasIdentifyingCopy(deploymentTitle(row))).toBe(false);
      expect(demoHasIdentifyingCopy(deploymentListMetaLine(row, now))).toBe(false);
    }
  });

  it('connects a demo team without mixing live account copy', () => {
    const connection = buildDemoConnection();
    expect(connection.status).toBe('connected');
    expect(connection.user?.username).toBe('example');
    expect(connection.teams[0]?.name).toBe('Example team');
    expect(demoHasIdentifyingCopy(JSON.stringify(connection))).toBe(false);
    const activity = JSON.stringify(buildDemoActivity(now));
    expect(demoHasIdentifyingCopy(activity)).toBe(false);
    expect(activity).not.toMatch(/prj_[a-zA-Z0-9]{20,}/);
  });
});

describe('DemoVercelAPIClient', () => {
  it('never hits the network and returns the fixture catalog', async () => {
    const api = new DemoVercelAPIClient();
    const projects = await api.listProjects(null);
    expect(projects).toHaveLength(4);
    const deploys = await api.listDeployments(DEMO_PROJECT_ID.portfolio, null);
    expect(deploys[0]?.meta.githubCommitMessage).toBe('Update landing page layout');
    const envs = await api.listEnvVarMeta(DEMO_PROJECT_ID.portfolio, null);
    expect(envs.every((env) => !('value' in env))).toBe(true);
    await expect(
      api.redeploy(deploys[0]!.id, DEMO_PROJECT_ID.portfolio, null),
    ).rejects.toThrow(/Demo mode/);
  });
});
