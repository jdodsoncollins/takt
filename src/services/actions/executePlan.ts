import type { ActionPlan, ActionDescriptor } from '../../domain/actions/taktAction';
import { ConfirmationPolicy } from '../../domain/policies/confirmationPolicy';
import type { VercelAPIClient } from '../api/vercelAPIClient';
import {
  analyzeEnvDrift,
  type EnvDriftReport,
} from '../../domain/analysis/envDrift';
import {
  formatIncidentSummaryText,
  summarizeFailedDeployment,
  type IncidentSummary,
} from '../../domain/analysis/incidentSummary';
import {
  compareDeployments,
  type DeploymentDiff,
} from '../../domain/analysis/deploymentCompare';
import type { VercelDeploymentSummary } from '../../domain/models/vercelModels';
import { buildObservabilitySnapshot } from '../../domain/analysis/observability';
import { explainFirewall } from '../../domain/analysis/firewallExplain';
import { buildFeatureFlagsReport } from '../../domain/analysis/featureFlags';
import {
  buildRuntimeLogReport,
  clampRuntimeLogQuery,
  type RuntimeLogQuery,
} from '../../domain/analysis/runtimeLogs';
import { pollDeploymentUntilTerminal } from '../../domain/analysis/deploymentPoll';
import {
  mutationConfirmationMatches,
  sourceDeploymentBelongsToProject,
  type MutationConfirmation,
} from '../../domain/actions/mutationSafety';

export interface StepResult {
  descriptorId: string;
  ok: boolean;
  message: string;
  data?: unknown;
}

export interface ExecutePlanResult {
  planId: string;
  ok: boolean;
  status: 'succeeded' | 'failed' | 'blocked';
  results: StepResult[];
  blockedReason?: string;
}

export type ExecutePlanOptions = {
  hardConfirmAcknowledged?: boolean;
  confirmedMutation?: MutationConfirmation;
};

function stepBlockReason(
  step: ActionDescriptor,
  policy: ConfirmationPolicy,
  opts: ExecutePlanOptions,
): string | null {
  const conf = policy.requirement(step.action);
  if (
    (conf === 'hardConfirm' || conf === 'destructiveConfirm') &&
    !opts.hardConfirmAcknowledged
  ) {
    return `Hard confirmation required for: ${step.title}`;
  }
  if (!mutationConfirmationMatches(step.action, opts.confirmedMutation)) {
    return `Mutation confirmation no longer matches: ${step.title}`;
  }
  return null;
}

/**
 * Execute allow-listed actions only.
 * High-risk steps require hardConfirmAcknowledged.
 * Never claims redeploy success until Vercel returns a deployment object
 * (caller still polls READY separately for final status).
 */
export async function executeApprovedPlan(
  plan: ActionPlan,
  api: VercelAPIClient,
  opts: ExecutePlanOptions = {},
): Promise<ExecutePlanResult> {
  const policy = ConfirmationPolicy.default;
  const results: StepResult[] = [];

  for (const step of plan.steps) {
    const blocked = stepBlockReason(step, policy, opts);
    if (blocked) {
      return {
        planId: plan.id,
        ok: false,
        status: 'blocked',
        results,
        blockedReason: blocked,
      };
    }

    try {
      const data = await runStep(step, api, opts.confirmedMutation);
      results.push({
        descriptorId: step.id,
        ok: true,
        message: step.title + ' succeeded',
        data,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({
        descriptorId: step.id,
        ok: false,
        message: `${step.title} failed: ${message}`,
      });
      if (e instanceof MutationBlockedError) {
        return {
          planId: plan.id,
          ok: false,
          status: 'blocked',
          results,
          blockedReason: message,
        };
      }
      return { planId: plan.id, ok: false, status: 'failed', results };
    }
  }

  return {
    planId: plan.id,
    ok: results.every((r) => r.ok),
    status: 'succeeded',
    results,
  };
}

async function runStep(
  step: ActionDescriptor,
  api: VercelAPIClient,
  confirmation?: MutationConfirmation,
): Promise<unknown> {
  const a = step.action;
  switch (a.type) {
    case 'listProjects':
      return api.listProjects(a.teamId);
    case 'listDeployments':
      return api.listDeployments(a.projectId, a.teamId);
    case 'getDeployment':
      return api.getDeployment(a.deploymentId, a.teamId);
    case 'getBuildLogs':
      return api.getBuildLogLines(a.deploymentId, a.teamId);
    case 'checkEnvDrift': {
      const envs = await api.listEnvVarMeta(a.projectId, a.teamId);
      const report: EnvDriftReport = analyzeEnvDrift(envs);
      return report;
    }
    case 'compareDeployments': {
      const [current, baseline] = await Promise.all([
        api.getDeployment(a.currentId, a.teamId),
        api.getDeployment(a.baselineId, a.teamId),
      ]);
      const diff: DeploymentDiff = compareDeployments(current, baseline);
      return diff;
    }
    case 'summarizeIncident': {
      const [failed, logs] = await Promise.all([
        api.getDeployment(a.deploymentId, a.teamId),
        api.getBuildLogLines(a.deploymentId, a.teamId, 80),
      ]);
      let lastSuccess: VercelDeploymentSummary | null = null;
      try {
        const list = await api.listDeployments(a.projectId, a.teamId, 20);
        lastSuccess =
          list.find(
            (d) => d.state === 'READY' && d.id !== failed.id,
          ) ?? null;
      } catch {
        lastSuccess = null;
      }
      let missingProductionEnvKeys: string[] = [];
      try {
        const envs = await api.listEnvVarMeta(a.projectId, a.teamId);
        const drift = analyzeEnvDrift(envs);
        missingProductionEnvKeys = [];
        for (const finding of drift.findings) {
          if (finding.kind === 'missing_in_production') {
            missingProductionEnvKeys.push(finding.key);
          }
        }
      } catch {
        // ignore
      }
      const summary: IncidentSummary = summarizeFailedDeployment({
        failed,
        lastSuccess,
        logLines: logs,
        missingProductionEnvKeys,
      });
      return {
        summary,
        text: formatIncidentSummaryText(summary),
      };
    }
    case 'diagnoseDomains':
      return api.diagnoseDomains(a.projectId, a.teamId);
    case 'loadObservability': {
      const raw = await api.fetchObservability(a.projectId, a.teamId);
      return buildObservabilitySnapshot(raw);
    }
    case 'explainFirewall': {
      const fw = await api.fetchFirewallStats(a.projectId, a.teamId);
      return explainFirewall({
        current: fw.current,
        previous: fw.previous,
        availability: fw.availability,
        note: fw.note,
      });
    }
    case 'listFeatureFlags': {
      const fl = await api.listFeatureFlags(a.projectId, a.teamId);
      return buildFeatureFlagsReport({
        flags: fl.flags,
        availability: fl.availability,
        note: fl.note,
      });
    }
    case 'queryRuntimeLogs': {
      const query = clampRuntimeLogQuery(a.query as RuntimeLogQuery);
      let deploymentId = a.deploymentId;
      if (!deploymentId) {
        const list = await api.listDeployments(a.projectId, a.teamId, 30);
        const match =
          list.find(
            (d) =>
              d.state === 'READY' &&
              (d.target === query.environment ||
                (query.environment === 'production' &&
                  d.target === 'production')),
          ) ?? list.find((d) => d.state === 'READY') ?? null;
        deploymentId = match?.id ?? null;
      }
      if (!deploymentId) {
        return buildRuntimeLogReport({
          query,
          deploymentId: null,
          entries: null,
          availability: 'no_data',
          note: 'No READY deployment found for runtime log query',
        });
      }
      return api.queryRuntimeLogs(
        a.projectId,
        deploymentId,
        a.teamId,
        query,
      );
    }
    case 'waitForDeploymentReady': {
      return pollDeploymentUntilTerminal({
        getState: async () => {
          const d = await api.getDeployment(a.deploymentId, a.teamId);
          return d.state;
        },
        maxAttempts: a.maxAttempts ?? 40,
        intervalMs: a.intervalMs ?? 3000,
      });
    }
    case 'redeploy':
      await validateSourceDeployment(api, a, confirmation);
      return api.redeploy(a.deploymentId, a.projectId, a.teamId, { target: a.target });
    case 'promoteToProduction':
      await validateSourceDeployment(api, a, confirmation);
      return api.redeploy(a.deploymentId, a.projectId, a.teamId, { target: 'production' });
    case 'rollbackProduction':
      await validateSourceDeployment(api, a, confirmation);
      return api.redeploy(a.deploymentId, a.projectId, a.teamId, { target: 'production' });
  }
}

async function validateSourceDeployment(
  api: VercelAPIClient,
  action: Extract<
    ActionDescriptor['action'],
    { type: 'redeploy' | 'promoteToProduction' | 'rollbackProduction' }
  >,
  confirmation: MutationConfirmation | undefined,
): Promise<void> {
  if (!mutationConfirmationMatches(action, confirmation)) {
    throw new MutationBlockedError(
      'Mutation confirmation does not match the requested scope',
    );
  }
  const deployments = await api.listDeployments(action.projectId, action.teamId, 100);
  if (!sourceDeploymentBelongsToProject(action.deploymentId, deployments)) {
    throw new MutationBlockedError(
      `Source deployment ${action.deploymentId} does not belong to confirmed project ${action.projectId}`,
    );
  }
}

class MutationBlockedError extends Error {}
