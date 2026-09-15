import {
  cryptoRandomId,
  type ActionDescriptor,
  type ActionRisk,
  type ConfirmationRequirement,
  type TaktAction,
} from '../actions/taktAction';

/**
 * Safety policy: redeploy / promote / rollback always hard-confirm.
 * Domain / firewall / flag mutations are not exposed as actions yet
 * (read-only diagnostics only). Env values never appear in payloads.
 */
export class ConfirmationPolicy {
  static readonly default = new ConfirmationPolicy();

  risk(forAction: TaktAction): ActionRisk {
    switch (forAction.type) {
      case 'listProjects':
      case 'listDeployments':
      case 'getDeployment':
      case 'getBuildLogs':
      case 'compareDeployments':
      case 'checkEnvDrift':
      case 'summarizeIncident':
      case 'diagnoseDomains':
      case 'loadObservability':
      case 'explainFirewall':
      case 'listFeatureFlags':
      case 'queryRuntimeLogs':
      case 'waitForDeploymentReady':
        return 'readOnly';
      case 'redeploy':
      case 'promoteToProduction':
        return 'high';
      case 'rollbackProduction':
        return 'destructive';
    }
  }

  requirement(forAction: TaktAction): ConfirmationRequirement {
    switch (this.risk(forAction)) {
      case 'readOnly':
        return 'none';
      case 'low':
        return 'inline';
      case 'medium':
        return 'review';
      case 'high':
        return 'hardConfirm';
      case 'destructive':
        return 'destructiveConfirm';
    }
  }

  descriptor(forAction: TaktAction): ActionDescriptor {
    return {
      id: cryptoRandomId(),
      action: forAction,
      title: this.title(forAction),
      summary: this.summary(forAction),
      risk: this.risk(forAction),
      confirmation: this.requirement(forAction),
      projectId: 'projectId' in forAction ? forAction.projectId : null,
      deploymentId:
        'deploymentId' in forAction ? forAction.deploymentId : null,
    };
  }

  private title(action: TaktAction): string {
    switch (action.type) {
      case 'listProjects':
        return 'List Projects';
      case 'listDeployments':
        return 'List Deployments';
      case 'getDeployment':
        return 'Get Deployment';
      case 'getBuildLogs':
        return 'Fetch Build Logs';
      case 'compareDeployments':
        return 'Compare Deployments';
      case 'checkEnvDrift':
        return 'Check Environment Drift';
      case 'summarizeIncident':
        return 'Summarize Incident';
      case 'diagnoseDomains':
        return 'Diagnose Domains';
      case 'loadObservability':
        return 'Load Observability';
      case 'explainFirewall':
        return 'Explain Firewall';
      case 'listFeatureFlags':
        return 'List Feature Flags';
      case 'queryRuntimeLogs':
        return 'Query Runtime Logs';
      case 'waitForDeploymentReady':
        return 'Wait for Deployment READY';
      case 'redeploy':
        return 'Redeploy';
      case 'promoteToProduction':
        return 'Promote to Production';
      case 'rollbackProduction':
        return 'Rollback Production';
    }
  }

  private summary(action: TaktAction): string {
    switch (action.type) {
      case 'listProjects':
        return 'Refresh project list from Vercel';
      case 'listDeployments':
        return `List deployments for project ${action.projectId}`;
      case 'getDeployment':
        return `Load deployment ${action.deploymentId}`;
      case 'getBuildLogs':
        return `Load build logs for ${action.deploymentId}`;
      case 'compareDeployments':
        return `Compare ${action.currentId} with ${action.baselineId}`;
      case 'checkEnvDrift':
        return `Compare env var presence for ${action.projectId} (names only)`;
      case 'summarizeIncident':
        return `Local incident summary for deployment ${action.deploymentId}`;
      case 'diagnoseDomains':
        return `Domain verification / DNS / SSL signals for ${action.projectId}`;
      case 'loadObservability':
        return `Observability snapshot for ${action.projectId} (honest empty states)`;
      case 'explainFirewall':
        return `Firewall explanation for ${action.projectId} (read-only)`;
      case 'listFeatureFlags':
        return `List feature flag metadata for ${action.projectId}`;
      case 'queryRuntimeLogs':
        return action.query.label;
      case 'waitForDeploymentReady':
        return `Poll ${action.deploymentId} until Vercel reports terminal state (READY only means success)`;
      case 'redeploy':
        return `Redeploy source ${action.deploymentId} for project ${action.projectId} to ${action.target ?? 'its current target'}`;
      case 'promoteToProduction':
        return `Promote source ${action.deploymentId} for project ${action.projectId} to production`;
      case 'rollbackProduction':
        return `Rollback project ${action.projectId} production to source ${action.deploymentId}`;
    }
  }
}
