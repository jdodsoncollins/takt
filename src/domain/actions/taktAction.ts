import type { DeploymentID, ProjectID, TeamID } from '../models/ids';

export type ActionRisk =
  | 'readOnly'
  | 'low'
  | 'medium'
  | 'high'
  | 'destructive';

export type ConfirmationRequirement =
  | 'none'
  | 'inline'
  | 'review'
  | 'hardConfirm'
  | 'destructiveConfirm';

/** Allow-listed Taktung actions. Model output must map to these only. */
export type TaktAction =
  | { type: 'listProjects'; teamId: TeamID | null }
  | { type: 'listDeployments'; projectId: ProjectID; teamId: TeamID | null }
  | { type: 'getDeployment'; deploymentId: DeploymentID; teamId: TeamID | null }
  | {
      type: 'getBuildLogs';
      deploymentId: DeploymentID;
      teamId: TeamID | null;
    }
  | {
      type: 'compareDeployments';
      projectId: ProjectID;
      currentId: DeploymentID;
      baselineId: DeploymentID;
      teamId: TeamID | null;
    }
  | {
      type: 'checkEnvDrift';
      projectId: ProjectID;
      teamId: TeamID | null;
    }
  | {
      type: 'summarizeIncident';
      projectId: ProjectID;
      deploymentId: DeploymentID;
      teamId: TeamID | null;
    }
  | {
      type: 'diagnoseDomains';
      projectId: ProjectID;
      teamId: TeamID | null;
    }
  | {
      type: 'loadObservability';
      projectId: ProjectID;
      teamId: TeamID | null;
    }
  | {
      type: 'explainFirewall';
      projectId: ProjectID;
      teamId: TeamID | null;
    }
  | {
      type: 'listFeatureFlags';
      projectId: ProjectID;
      teamId: TeamID | null;
    }
  | {
      type: 'queryRuntimeLogs';
      projectId: ProjectID;
      teamId: TeamID | null;
      /** Optional pin; otherwise executor picks latest READY for query.environment. */
      deploymentId: DeploymentID | null;
      /** Serialized RuntimeLogQuery fields (validated domain type). */
      query: {
        environment: 'production' | 'preview';
        sinceMs: number;
        untilMs: number | null;
        statusClass: '5xx' | '4xx' | 'all';
        levels: Array<'error' | 'warning' | 'info' | 'fatal'> | null;
        pathContains: string | null;
        limit: number;
        label: string;
      };
    }
  | {
      type: 'waitForDeploymentReady';
      deploymentId: DeploymentID;
      teamId: TeamID | null;
      /** Poll budget; domain defaults apply when omitted. */
      maxAttempts?: number;
      intervalMs?: number;
    }
  | {
      type: 'redeploy';
      deploymentId: DeploymentID;
      projectId: ProjectID;
      teamId: TeamID | null;
      target: 'production' | 'preview' | null;
    }
  | {
      type: 'promoteToProduction';
      deploymentId: DeploymentID;
      projectId: ProjectID;
      teamId: TeamID | null;
    }
  | {
      type: 'rollbackProduction';
      deploymentId: DeploymentID;
      projectId: ProjectID;
      teamId: TeamID | null;
    };

export interface ActionDescriptor {
  id: string;
  action: TaktAction;
  title: string;
  summary: string;
  risk: ActionRisk;
  confirmation: ConfirmationRequirement;
  projectId?: ProjectID | null;
  deploymentId?: DeploymentID | null;
}

export interface ActionPlan {
  id: string;
  title: string;
  rationale: string;
  steps: ActionDescriptor[];
  createdAt: string;
}

export function cryptoRandomId(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newActionPlan(
  title: string,
  rationale: string,
  steps: ActionDescriptor[],
): ActionPlan {
  return {
    id: cryptoRandomId(),
    title,
    rationale,
    steps,
    createdAt: new Date().toISOString(),
  };
}
