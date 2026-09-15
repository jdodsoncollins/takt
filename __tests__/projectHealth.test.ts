import { describe, expect, it } from 'vitest';
import {
  buildProjectHealthCard,
  computeAttention,
  mapDeploymentState,
  summarizeDeployments,
} from '../src/domain/analysis/projectHealth';
import { deploymentID, projectID } from '../src/domain/models/ids';
import type {
  VercelDeploymentSummary,
  VercelProject,
} from '../src/domain/models/vercelModels';

function dep(
  id: string,
  state: VercelDeploymentSummary['state'],
  target: VercelDeploymentSummary['target'],
  createdAt = Date.now(),
): VercelDeploymentSummary {
  return {
    id: deploymentID(id),
    url: null,
    name: 'app',
    state,
    target,
    createdAt,
    readyAt: null,
    buildingAt: null,
    source: null,
    meta: {},
    inspectorUrl: null,
  };
}

describe('project health', () => {
  it('models every documented deployment state including BLOCKED', () => {
    for (const state of [
      'BLOCKED',
      'BUILDING',
      'CANCELED',
      'DELETED',
      'ERROR',
      'INITIALIZING',
      'QUEUED',
      'READY',
    ] as const) {
      expect(mapDeploymentState(state)).toBe(state);
    }
  });

  it('flags failed production as needs attention', () => {
    const a = computeAttention({
      production: dep('p', 'ERROR', 'production'),
      latest: dep('p', 'ERROR', 'production'),
      lastSuccess: dep('s', 'READY', 'production', Date.now() - 10000),
      latestFailed: dep('p', 'ERROR', 'production'),
    });
    expect(a.needsAttention).toBe(true);
    expect(a.attentionReason).toBe('latest_production_failed');
  });

  it('summarizes deployments correctly', () => {
    const s = summarizeDeployments([
      dep('new', 'ERROR', 'production', 3),
      dep('ok', 'READY', 'production', 2),
      dep('prev', 'READY', 'preview', 1),
    ]);
    expect(s.latest?.id).toBe('new');
    expect(s.production?.id).toBe('new');
    expect(s.lastSuccess?.id).toBe('ok');
    expect(s.latestFailed?.id).toBe('new');
  });

  it('flags a later production failure even when current prod is READY', () => {
    const a = computeAttention({
      production: dep('ok', 'READY', 'production', 20),
      latest: dep('ok', 'READY', 'production', 20),
      lastSuccess: dep('ok', 'READY', 'production', 20),
      latestFailed: dep('bad', 'ERROR', 'production', 10),
    });
    expect(a.needsAttention).toBe(true);
    expect(a.attentionReason).toBe('recent_failure');
  });

  it('does not flag an older preview failure when production is READY', () => {
    const a = computeAttention({
      production: dep('ok', 'READY', 'production', 20),
      latest: dep('ok', 'READY', 'production', 20),
      lastSuccess: dep('ok', 'READY', 'production', 20),
      latestFailed: dep('prev', 'ERROR', 'preview', 5),
    });
    expect(a.needsAttention).toBe(false);
    expect(a.attentionReason).toBe('none');
  });

  it('builds critical health card', () => {
    const project: VercelProject = {
      id: projectID('prj_1'),
      name: 'shop',
      framework: 'nextjs',
      nodeVersion: '20.x',
      primaryDomain: 'shop.vercel.app',
      productionDeployment: dep('p', 'ERROR', 'production'),
      latestDeployment: dep('p', 'ERROR', 'production'),
      lastSuccessfulDeployment: dep('s', 'READY', 'production'),
      latestFailedDeployment: dep('p', 'ERROR', 'production'),
      needsAttention: true,
      attentionReason: 'latest_production_failed',
      teamId: null,
    };
    const card = buildProjectHealthCard(project);
    expect(card.level).toBe('critical');
    expect(card.suggestedNextStep).toBeTruthy();
  });
});
