import type { DeploymentID, ProjectID, TeamID } from '../models/ids';
import type { VercelDeploymentSummary } from '../models/vercelModels';
import type { TaktAction } from './taktAction';

export interface MutationConfirmation {
  projectId: ProjectID;
  sourceDeploymentId: DeploymentID;
  target: 'production' | 'preview' | null;
  teamId: TeamID | null;
}

export function mutationConfirmationFor(
  action: Extract<
    TaktAction,
    { type: 'redeploy' | 'promoteToProduction' | 'rollbackProduction' }
  >,
): MutationConfirmation {
  return {
    projectId: action.projectId,
    sourceDeploymentId: action.deploymentId,
    target: action.type === 'redeploy' ? action.target : 'production',
    teamId: action.teamId,
  };
}

export function mutationConfirmationMatches(
  action: TaktAction,
  confirmation: MutationConfirmation | undefined,
): boolean {
  if (
    action.type !== 'redeploy' &&
    action.type !== 'promoteToProduction' &&
    action.type !== 'rollbackProduction'
  ) {
    return true;
  }
  if (!confirmation) return false;
  const expected = mutationConfirmationFor(action);
  return (
    confirmation.projectId === expected.projectId &&
    confirmation.sourceDeploymentId === expected.sourceDeploymentId &&
    confirmation.target === expected.target &&
    confirmation.teamId === expected.teamId
  );
}

export function sourceDeploymentBelongsToProject(
  sourceDeploymentId: DeploymentID,
  projectDeployments: VercelDeploymentSummary[],
): boolean {
  return projectDeployments.some((deployment) => deployment.id === sourceDeploymentId);
}

export function formatMutationConfirmation(
  confirmation: MutationConfirmation,
): string {
  return [
    `Project: ${confirmation.projectId}`,
    `Source deployment: ${confirmation.sourceDeploymentId}`,
    `Target: ${confirmation.target ?? 'preserve source target'}`,
  ].join('\n');
}
