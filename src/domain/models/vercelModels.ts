import type { DeploymentID, ProjectID, TeamID } from './ids';

export type DeploymentState =
  | 'BLOCKED'
  | 'BUILDING'
  | 'ERROR'
  | 'INITIALIZING'
  | 'QUEUED'
  | 'READY'
  | 'CANCELED'
  | 'DELETED'
  | 'UNKNOWN';

export type DeploymentTarget = 'production' | 'preview' | 'development' | null;

export type AttentionReason =
  | 'latest_production_failed'
  | 'building'
  | 'no_production'
  | 'stale_success'
  | 'recent_failure'
  | 'none';

export interface VercelTeam {
  id: TeamID;
  name: string;
  slug: string;
}

export interface VercelUser {
  id: string;
  name: string | null;
  username: string;
  email: string | null;
}

export interface VercelDeploymentSummary {
  id: DeploymentID;
  url: string | null;
  name: string;
  state: DeploymentState;
  target: DeploymentTarget;
  createdAt: number;
  readyAt: number | null;
  buildingAt: number | null;
  source: string | null;
  /** GitHub / Vercel username who created the deploy. Never an email. */
  creatorUsername?: string | null;
  /** Present on list payloads; Vercel only marks some READY deploys. */
  isRollbackCandidate?: boolean | null;
  /** First region from detail, e.g. iad1. */
  region?: string | null;
  meta: {
    githubCommitRef?: string | null;
    githubCommitSha?: string | null;
    githubCommitMessage?: string | null;
    githubCommitAuthorName?: string | null;
    githubCommitAuthorLogin?: string | null;
  };
  inspectorUrl: string | null;
  /** Aliases when known (detail fetch). */
  aliases?: string[];
  /** Build duration ms when ready/failed. */
  buildDurationMs?: number | null;
  /** Hashed lambda outputs from v13 detail. Absent on list rows. */
  lambdaOutputs?: Array<{
    path: string;
    functionName: string;
    readyState: string | null;
  }>;
}

export interface VercelProject {
  id: ProjectID;
  name: string;
  framework: string | null;
  /** Node or other runtime label when available. */
  nodeVersion: string | null;
  /** Primary production domain if known. */
  primaryDomain: string | null;
  /** Latest production deployment (from project targets or list). */
  productionDeployment: VercelDeploymentSummary | null;
  latestDeployment: VercelDeploymentSummary | null;
  lastSuccessfulDeployment: VercelDeploymentSummary | null;
  latestFailedDeployment: VercelDeploymentSummary | null;
  needsAttention: boolean;
  attentionReason: AttentionReason;
  teamId: TeamID | null;
  link?: {
    type: string;
    repo?: string;
    org?: string;
  } | null;
}

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface VercelConnection {
  status: ConnectionStatus;
  user: VercelUser | null;
  teams: VercelTeam[];
  selectedTeamId: TeamID | null;
  errorMessage: string | null;
}

export function connectionIsConnected(c: VercelConnection): boolean {
  return c.status === 'connected' && c.user != null;
}

export type ActivityOutcome = 'success' | 'failure' | 'canceled' | 'info';

export type ActivityKind =
  | 'connect'
  | 'disconnect'
  | 'refresh_projects'
  | 'load_deployments'
  | 'load_logs'
  | 'incident_summary'
  | 'env_drift'
  | 'domain_diagnostics'
  | 'deployment_compare'
  | 'observability'
  | 'firewall'
  | 'feature_flags'
  | 'runtime_logs'
  | 'deployment_poll'
  | 'redeploy'
  | 'promote'
  | 'rollback'
  | 'plan_execute'
  | 'inspect_functions'
  | 'note';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  outcome: ActivityOutcome;
  createdAt: string;
  projectId?: string | null;
  deploymentId?: string | null;
  /** Structured change records for future revert (no secrets). */
  changeRecords?: Record<string, unknown>[];
}

/** Env var metadata only — never secret values. */
export interface EnvVarMeta {
  id: string;
  key: string;
  type: string;
  target: string[];
  gitBranch?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
}

export type DataAvailability =
  | 'ok'
  | 'no_data'
  | 'unavailable_for_plan'
  | 'not_enabled'
  | 'temporarily_unavailable';

export interface MetricSlot<T> {
  availability: DataAvailability;
  value: T | null;
  note?: string;
}

export function emptyConnection(): VercelConnection {
  return {
    status: 'disconnected',
    user: null,
    teams: [],
    selectedTeamId: null,
    errorMessage: null,
  };
}
