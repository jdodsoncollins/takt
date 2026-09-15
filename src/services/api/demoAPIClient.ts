import type {
  DeploymentID,
  ProjectID,
  TeamID,
} from '../../domain/models/ids';
import type {
  EnvVarMeta,
  VercelDeploymentSummary,
  VercelProject,
  VercelTeam,
  VercelUser,
} from '../../domain/models/vercelModels';
import type { DomainDiagnosticsReport } from '../../domain/analysis/domainDiagnostics';
import type { ObservabilityFetchResult } from '../../domain/analysis/observability';
import type { FirewallPeriodStats } from '../../domain/analysis/firewallExplain';
import type { FeatureFlagMeta } from '../../domain/analysis/featureFlags';
import type { DataAvailability } from '../../domain/models/vercelModels';
import type {
  RuntimeLogQuery,
  RuntimeLogReport,
} from '../../domain/analysis/runtimeLogs';
import type {
  FunctionsInventoryReport,
  LambdaOutputRow,
} from '../../domain/analysis/deploymentFunctions';
import {
  DEMO_TEAM,
  DEMO_USER,
  buildDemoDeployments,
  buildDemoProjects,
  findDemoDeployment,
} from '../../support/demoFixtures';
import { VercelAPIError } from './errors';
import type { VercelAPIClient } from './vercelAPIClient';

/**
 * In-memory Vercel client for EXPO_PUBLIC_TAKT_DEMO_MODE. Never fetches.
 */
export class DemoVercelAPIClient implements VercelAPIClient {
  async getUser(): Promise<VercelUser> {
    return DEMO_USER;
  }

  async listTeams(): Promise<VercelTeam[]> {
    return [DEMO_TEAM];
  }

  async listProjects(_teamId: TeamID | null): Promise<VercelProject[]> {
    return buildDemoProjects();
  }

  async listDeployments(
    projectId: ProjectID,
    _teamId: TeamID | null,
    _limit?: number,
  ): Promise<VercelDeploymentSummary[]> {
    return buildDemoDeployments(projectId);
  }

  async getDeployment(
    id: DeploymentID,
    _teamId: TeamID | null,
  ): Promise<VercelDeploymentSummary> {
    const found = findDemoDeployment(id);
    if (!found) {
      throw VercelAPIError.decodeFailed('deployment', 'demo deployment missing');
    }
    return found;
  }

  async getBuildLogLines(
    _id: DeploymentID,
    _teamId: TeamID | null,
    _limit?: number,
  ): Promise<{ text: string; type?: string | null; created?: number | null }[]> {
    return [
      { text: 'Compiling…', type: 'stdout', created: Date.now() - 40_000 },
      { text: 'Build completed.', type: 'stdout', created: Date.now() - 8_000 },
    ];
  }

  async listEnvVarMeta(
    _projectId: ProjectID,
    _teamId: TeamID | null,
  ): Promise<EnvVarMeta[]> {
    return [
      {
        id: 'env_demo_1',
        key: 'NEXT_PUBLIC_SITE_URL',
        type: 'plain',
        target: ['production', 'preview'],
      },
    ];
  }

  async redeploy(
    _deploymentId: DeploymentID,
    _projectId: ProjectID,
    _teamId: TeamID | null,
    _opts?: { target?: 'production' | 'preview' | null },
  ): Promise<VercelDeploymentSummary> {
    throw new Error('Demo mode cannot mutate deployments.');
  }

  async diagnoseDomains(
    projectId: ProjectID,
    _teamId: TeamID | null,
  ): Promise<DomainDiagnosticsReport> {
    return {
      projectId,
      domains: [],
      summary: 'No domain diagnostics in demo mode.',
      availability: 'no_data',
    };
  }

  async fetchObservability(
    _projectId: ProjectID,
    _teamId: TeamID | null,
  ): Promise<ObservabilityFetchResult> {
    return { kind: 'no_data', detail: 'Demo mode' };
  }

  async fetchFirewallStats(
    _projectId: ProjectID,
    _teamId: TeamID | null,
  ): Promise<{
    availability: DataAvailability;
    current: FirewallPeriodStats | null;
    previous: FirewallPeriodStats | null;
    note?: string;
  }> {
    return {
      availability: 'no_data',
      current: null,
      previous: null,
      note: 'Demo mode',
    };
  }

  async listFeatureFlags(
    _projectId: ProjectID,
    _teamId: TeamID | null,
  ): Promise<{
    availability: DataAvailability;
    flags: FeatureFlagMeta[] | null;
    note?: string;
  }> {
    return { availability: 'no_data', flags: null, note: 'Demo mode' };
  }

  async queryRuntimeLogs(
    _projectId: ProjectID,
    _deploymentId: DeploymentID,
    _teamId: TeamID | null,
    query: RuntimeLogQuery,
  ): Promise<RuntimeLogReport> {
    return {
      query,
      deploymentId: null,
      availability: 'no_data',
      entries: [],
      summary: 'No runtime logs in demo mode.',
      bullets: [],
      topPaths: [],
      errorCount: 0,
    };
  }

  async fetchDeploymentFunctions(
    _id: DeploymentID,
    _teamId: TeamID | null,
    _opts?: {
      lambdaOutputs?: LambdaOutputRow[] | null;
      nodeVersion?: string | null;
    },
  ): Promise<FunctionsInventoryReport> {
    return {
      availability: 'no_data',
      functions: [],
      source: 'none',
      note: 'Function inventory not published for this build.',
    };
  }
}
