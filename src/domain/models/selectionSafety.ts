import type { DeploymentID, ProjectID, TeamID } from './ids';
import type { VercelDeploymentSummary } from './vercelModels';

export interface SelectionScope {
  generation: number;
  teamId: TeamID | null;
  projectId: ProjectID | null;
}

export function selectionScopeIsCurrent(
  captured: SelectionScope,
  current: SelectionScope,
): boolean {
  return (
    captured.generation === current.generation &&
    captured.teamId === current.teamId &&
    captured.projectId === current.projectId
  );
}

export function deploymentCanBeSelected(
  deploymentId: DeploymentID,
  projectId: ProjectID | null,
  deploymentsProjectId: ProjectID | null,
  deployments: VercelDeploymentSummary[],
): boolean {
  return (
    projectId != null &&
    projectId === deploymentsProjectId &&
    deployments.some((deployment) => deployment.id === deploymentId)
  );
}

/** Prefer the in-scope selected row; otherwise the list row for this route. Never wait on getDeployment to paint. */
export function resolveSheetDeployment(
  routeId: string | undefined,
  selected: VercelDeploymentSummary | null,
  list: VercelDeploymentSummary[],
): VercelDeploymentSummary | null {
  if (selected && (routeId == null || routeId === '' || selected.id === routeId)) {
    return selected;
  }
  if (routeId == null || routeId === '') return selected;
  return list.find((deployment) => deployment.id === routeId) ?? null;
}
