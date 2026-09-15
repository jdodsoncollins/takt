import type { OpsCommandId } from './opsCommands';
import type { ProjectID } from '../../domain/models/ids';

export type SearchCommandRunner = {
  runIncidentSummary: () => Promise<void>;
  runEnvDriftCheck: () => Promise<void>;
  runDomainDiagnostics: () => Promise<void>;
  runDeploymentCompare: () => Promise<void>;
  runFirewallExplain: () => Promise<void>;
  runFeatureFlags: () => Promise<void>;
  runRuntimeLogQuery: (raw: string) => Promise<void>;
  runOpsBrief: () => Promise<void>;
  loadBuildLogs: () => Promise<void>;
  loadDeployments: (projectId: ProjectID) => Promise<void>;
  selectedProjectId: ProjectID | null;
};

type FetchableCommand = Exclude<
  OpsCommandId,
  'unknown' | 'projects' | 'activity' | 'settings'
>;

const FETCHERS: Record<
  FetchableCommand,
  (runner: SearchCommandRunner, raw: string) => Promise<void>
> = {
  incident: (runner) => runner.runIncidentSummary(),
  env: (runner) => runner.runEnvDriftCheck(),
  domain: (runner) => runner.runDomainDiagnostics(),
  compare: (runner) => runner.runDeploymentCompare(),
  firewall: (runner) => runner.runFirewallExplain(),
  flags: (runner) => runner.runFeatureFlags(),
  runtime: (runner, raw) => runner.runRuntimeLogQuery(raw),
  issues: (runner) => runner.runOpsBrief(),
  logs: (runner) => runner.loadBuildLogs(),
  deploys: async (runner) => {
    if (runner.selectedProjectId) {
      await runner.loadDeployments(runner.selectedProjectId);
    }
  },
};

export async function fetchSearchCommand(
  id: Exclude<OpsCommandId, 'unknown'>,
  raw: string,
  runner: SearchCommandRunner,
): Promise<void> {
  if (id === 'projects' || id === 'activity' || id === 'settings') return;
  await FETCHERS[id](runner, raw);
}
