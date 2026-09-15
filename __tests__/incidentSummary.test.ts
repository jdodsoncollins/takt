import { describe, expect, it } from 'vitest';
import {
  firstCommitLine,
  formatIncidentSummaryText,
  summarizeFailedDeployment,
} from '../src/domain/analysis/incidentSummary';
import { deploymentID } from '../src/domain/models/ids';
import type { VercelDeploymentSummary } from '../src/domain/models/vercelModels';

function dep(
  id: string,
  overrides: Partial<Omit<VercelDeploymentSummary, 'id'>> = {},
): VercelDeploymentSummary {
  return {
    id: deploymentID(id),
    url: overrides.url ?? null,
    name: overrides.name ?? 'app',
    state: overrides.state ?? 'ERROR',
    target: overrides.target ?? 'production',
    createdAt: overrides.createdAt ?? Date.now(),
    readyAt: overrides.readyAt ?? null,
    buildingAt: overrides.buildingAt ?? null,
    source: null,
    meta: overrides.meta ?? {
      githubCommitSha: 'abc1234567890',
      githubCommitMessage: 'feat: checkout',
      githubCommitRef: 'main',
    },
    inspectorUrl: null,
  };
}

describe('summarizeFailedDeployment', () => {
  it('uses missing production env keys as high-confidence cause', () => {
    const s = summarizeFailedDeployment({
      failed: dep('dpl_fail'),
      lastSuccess: dep('dpl_ok', { state: 'READY' }),
      logLines: [{ text: 'Build completed' }],
      missingProductionEnvKeys: ['STRIPE_SECRET_KEY'],
    });
    expect(s.likelyCause).toContain('STRIPE_SECRET_KEY');
    expect(s.confidence).toBe('high');
    expect(formatIncidentSummaryText(s)).toContain('Suggested action');
  });

  it('detects module not found from logs', () => {
    const s = summarizeFailedDeployment({
      failed: dep('dpl_fail'),
      lastSuccess: null,
      logLines: [{ text: 'Error: Cannot find module "foo"' }],
    });
    expect(s.likelyCause).toMatch(/dependency|import/i);
    expect(s.confidence).toBe('high');
  });

  it('stays low confidence when logs empty', () => {
    const s = summarizeFailedDeployment({
      failed: dep('dpl_fail'),
      lastSuccess: null,
      logLines: [],
    });
    expect(s.confidence).toBe('low');
  });

  it('does not treat READY as a failure', () => {
    const s = summarizeFailedDeployment({
      failed: dep('dpl_ok', {
        state: 'READY',
        meta: {
          githubCommitSha: 'abc1234567890',
          githubCommitMessage:
            'Center the rings\n\nThey were sitting too low under the gloss',
          githubCommitRef: 'main',
        },
      }),
      lastSuccess: null,
      logLines: [{ text: 'missing TOKEN in env' }],
    });
    expect(s.confidence).toBe('low');
    expect(s.likelyCause).toBeNull();
    expect(s.commitSubject).toBe('Center the rings');
    expect(s.evidence).toEqual([]);
  });
});

describe('firstCommitLine', () => {
  it('keeps only the subject line', () => {
    expect(
      firstCommitLine('Center the rings\n\nThey were sitting too low'),
    ).toBe('Center the rings');
  });
});
