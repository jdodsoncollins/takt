import { describe, expect, it } from 'vitest';
import { ConfirmationPolicy } from '../src/domain/policies/confirmationPolicy';
import { deploymentID, projectID, teamID } from '../src/domain/models/ids';

const policy = ConfirmationPolicy.default;

describe('ConfirmationPolicy', () => {
  it('marks read actions as readOnly / none', () => {
    const d = policy.descriptor({
      type: 'listProjects',
      teamId: null,
    });
    expect(d.risk).toBe('readOnly');
    expect(d.confirmation).toBe('none');
  });

  it('requires hardConfirm for redeploy', () => {
    const d = policy.descriptor({
      type: 'redeploy',
      deploymentId: deploymentID('dpl_1'),
      projectId: projectID('prj_1'),
      teamId: teamID('team_1'),
      target: 'production',
    });
    expect(d.risk).toBe('high');
    expect(d.confirmation).toBe('hardConfirm');
  });

  it('requires destructiveConfirm for rollback', () => {
    const d = policy.descriptor({
      type: 'rollbackProduction',
      deploymentId: deploymentID('dpl_1'),
      projectId: projectID('prj_1'),
      teamId: null,
    });
    expect(d.risk).toBe('destructive');
    expect(d.confirmation).toBe('destructiveConfirm');
  });

  it('keeps env drift read-only', () => {
    const d = policy.descriptor({
      type: 'checkEnvDrift',
      projectId: projectID('prj_1'),
      teamId: null,
    });
    expect(d.confirmation).toBe('none');
  });

  it('keeps domain / firewall / flags reads as none confirmation', () => {
    for (const type of [
      'diagnoseDomains',
      'loadObservability',
      'explainFirewall',
      'listFeatureFlags',
    ] as const) {
      const d = policy.descriptor({
        type,
        projectId: projectID('prj_1'),
        teamId: null,
      });
      expect(d.risk).toBe('readOnly');
      expect(d.confirmation).toBe('none');
    }
  });

  it('keeps runtime log query and ready poll as readOnly', () => {
    const logs = policy.descriptor({
      type: 'queryRuntimeLogs',
      projectId: projectID('prj_1'),
      teamId: null,
      deploymentId: null,
      query: {
        environment: 'production',
        sinceMs: Date.now() - 3600_000,
        untilMs: null,
        statusClass: '5xx',
        levels: ['error'],
        pathContains: null,
        limit: 50,
        label: 'test',
      },
    });
    expect(logs.confirmation).toBe('none');
    const wait = policy.descriptor({
      type: 'waitForDeploymentReady',
      deploymentId: deploymentID('dpl_1'),
      teamId: null,
    });
    expect(wait.confirmation).toBe('none');
  });
});
