import { describe, expect, it } from 'vitest';
import {
  deploymentCanBeSelected,
  resolveSheetDeployment,
  selectionScopeIsCurrent,
} from '../src/domain/models/selectionSafety';
import { deploymentID, projectID, teamID } from '../src/domain/models/ids';
import type { VercelDeploymentSummary } from '../src/domain/models/vercelModels';

const deployment: VercelDeploymentSummary = {
  id: deploymentID('dpl_1'),
  name: 'app',
  url: null,
  state: 'READY',
  target: 'production',
  createdAt: 1,
  readyAt: 1,
  buildingAt: null,
  source: null,
  meta: {},
  inspectorUrl: null,
};

describe('selection safety', () => {
  it('rejects a stale generation or changed project', () => {
    const captured = {
      generation: 1,
      teamId: teamID('team_1'),
      projectId: projectID('prj_1'),
    };
    expect(selectionScopeIsCurrent(captured, captured)).toBe(true);
    expect(selectionScopeIsCurrent(captured, { ...captured, generation: 2 })).toBe(false);
    expect(selectionScopeIsCurrent(captured, {
      ...captured,
      projectId: projectID('prj_2'),
    })).toBe(false);
  });

  it('resolves a sheet from the list when selected is empty or a different id', () => {
    const other: VercelDeploymentSummary = { ...deployment, id: deploymentID('dpl_2') };
    expect(resolveSheetDeployment('dpl_1', null, [deployment])).toEqual(deployment);
    expect(resolveSheetDeployment('dpl_1', other, [deployment])).toEqual(deployment);
    expect(resolveSheetDeployment('dpl_1', deployment, [deployment])).toBe(deployment);
    expect(resolveSheetDeployment('dpl_9', null, [deployment])).toBeNull();
  });

  it('never selects a deployment list owned by another project', () => {
    expect(deploymentCanBeSelected(
      deployment.id,
      projectID('prj_1'),
      projectID('prj_1'),
      [deployment],
    )).toBe(true);
    expect(deploymentCanBeSelected(
      deployment.id,
      projectID('prj_2'),
      projectID('prj_1'),
      [deployment],
    )).toBe(false);
  });
});
