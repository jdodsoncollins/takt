import { describe, expect, it } from 'vitest';
import {
  formatMutationConfirmation,
  mutationConfirmationFor,
  mutationConfirmationMatches,
} from '../src/domain/actions/mutationSafety';
import { deploymentID, projectID, teamID } from '../src/domain/models/ids';

describe('mutation safety', () => {
  const action = {
    type: 'promoteToProduction' as const,
    projectId: projectID('prj_1'),
    deploymentId: deploymentID('dpl_1'),
    teamId: teamID('team_1'),
  };

  it('pins exact project, source, target, and team', () => {
    const confirmation = mutationConfirmationFor(action);
    expect(mutationConfirmationMatches(action, confirmation)).toBe(true);
    expect(mutationConfirmationMatches(action, {
      ...confirmation,
      projectId: projectID('prj_2'),
    })).toBe(false);
  });

  it('renders exact production mutation identity', () => {
    expect(formatMutationConfirmation(mutationConfirmationFor(action))).toBe(
      'Project: prj_1\nSource deployment: dpl_1\nTarget: production',
    );
  });
});
