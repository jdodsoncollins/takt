import { describe, expect, it, vi } from 'vitest';
import { executeApprovedPlan } from '../src/services/actions/executePlan';
import { ConfirmationPolicy } from '../src/domain/policies/confirmationPolicy';
import { newActionPlan } from '../src/domain/actions/taktAction';
import { mutationConfirmationFor } from '../src/domain/actions/mutationSafety';
import { deploymentID, projectID } from '../src/domain/models/ids';
import type { VercelAPIClient } from '../src/services/api/vercelAPIClient';
import type { VercelDeploymentSummary } from '../src/domain/models/vercelModels';

function mockApi(partial: Partial<VercelAPIClient>): VercelAPIClient {
  return {
    getUser: vi.fn(),
    listTeams: vi.fn(),
    listProjects: vi.fn(),
    listDeployments: vi.fn(),
    getDeployment: vi.fn(),
    getBuildLogLines: vi.fn(),
    listEnvVarMeta: vi.fn(),
    redeploy: vi.fn(),
    diagnoseDomains: vi.fn(),
    fetchObservability: vi.fn(),
    fetchFirewallStats: vi.fn(),
    listFeatureFlags: vi.fn(),
    queryRuntimeLogs: vi.fn(),
    ...partial,
  } as VercelAPIClient;
}

describe('executeApprovedPlan', () => {
  it('blocks high-risk without hard confirm', async () => {
    const policy = ConfirmationPolicy.default;
    const step = policy.descriptor({
      type: 'redeploy',
      deploymentId: deploymentID('dpl_1'),
      projectId: projectID('prj_1'),
      teamId: null,
      target: 'production',
    });
    const plan = newActionPlan('Redeploy', 'test', [step]);
    const redeploy = vi.fn();
    const result = await executeApprovedPlan(plan, mockApi({ redeploy }), {
      hardConfirmAcknowledged: false,
    });
    expect(result.ok).toBe(false);
    expect(result.blockedReason).toMatch(/Hard confirmation/i);
    expect(redeploy).not.toHaveBeenCalled();
  });

  it('runs redeploy when confirmed', async () => {
    const policy = ConfirmationPolicy.default;
    const step = policy.descriptor({
      type: 'redeploy',
      deploymentId: deploymentID('dpl_1'),
      projectId: projectID('prj_1'),
      teamId: null,
      target: 'production',
    });
    const plan = newActionPlan('Redeploy', 'test', [step]);
    const redeploy = vi.fn().mockResolvedValue({
      id: 'dpl_2',
      state: 'BUILDING',
      name: 'app',
    });
    const listDeployments = vi.fn().mockResolvedValue([
      { id: deploymentID('dpl_1') } as VercelDeploymentSummary,
    ]);
    const result = await executeApprovedPlan(plan, mockApi({ redeploy, listDeployments }), {
      hardConfirmAcknowledged: true,
      confirmedMutation: mutationConfirmationFor(step.action as Extract<
        typeof step.action,
        { type: 'redeploy' }
      >),
    });
    expect(result.ok).toBe(true);
    expect(redeploy).toHaveBeenCalledWith(
      deploymentID('dpl_1'),
      projectID('prj_1'),
      null,
      { target: 'production' },
    );
  });

  it('rejects a source deployment outside the confirmed project', async () => {
    const step = ConfirmationPolicy.default.descriptor({
      type: 'redeploy',
      deploymentId: deploymentID('dpl_wrong'),
      projectId: projectID('prj_1'),
      teamId: null,
      target: 'production',
    });
    const redeploy = vi.fn();
    const result = await executeApprovedPlan(
      newActionPlan('Redeploy', 'test', [step]),
      mockApi({ listDeployments: vi.fn().mockResolvedValue([]), redeploy }),
      {
        hardConfirmAcknowledged: true,
        confirmedMutation: mutationConfirmationFor(step.action as Extract<
          typeof step.action,
          { type: 'redeploy' }
        >),
      },
    );
    expect(result.status).toBe('blocked');
    expect(result.blockedReason).toMatch(/does not belong/);
    expect(result.results[0]?.message).toMatch(/does not belong/);
    expect(redeploy).not.toHaveBeenCalled();
  });

  it('runs env drift read action without confirm', async () => {
    const policy = ConfirmationPolicy.default;
    const step = policy.descriptor({
      type: 'checkEnvDrift',
      projectId: projectID('prj_1'),
      teamId: null,
    });
    const plan = newActionPlan('Drift', 'test', [step]);
    const listEnvVarMeta = vi.fn().mockResolvedValue([
      {
        id: '1',
        key: 'A',
        type: 'encrypted',
        target: ['production'],
      },
    ]);
    const result = await executeApprovedPlan(
      plan,
      mockApi({ listEnvVarMeta }),
    );
    expect(result.ok).toBe(true);
    expect(listEnvVarMeta).toHaveBeenCalled();
  });
});
