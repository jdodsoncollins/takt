import { describe, expect, it } from 'vitest';
import {
  matchOpsCommand,
  OPS_COMMAND_CATALOG,
  OPS_COMMAND_SUGGESTIONS,
  rankOpsCommands,
} from '../src/features/command/opsCommands';

describe('matchOpsCommand', () => {
  it('maps check-for-issues phrasing to the brief', () => {
    expect(matchOpsCommand('check for issues')).toBe('issues');
    expect(matchOpsCommand('diagnose')).toBe('issues');
    expect(matchOpsCommand('ops brief')).toBe('issues');
    // Free-text like "what should I do next" is for the on-device router, not the chip ranker.
  });

  it('maps diagnostic phrases', () => {
    expect(matchOpsCommand('why did this fail')).toBe('incident');
    expect(matchOpsCommand('env drift')).toBe('env');
    expect(matchOpsCommand('domain ssl')).toBe('domain');
    expect(matchOpsCommand('what changed')).toBe('compare');
    expect(matchOpsCommand('production 5xx since this morning')).toBe(
      'runtime',
    );
  });

  it('matches deploy even when it is not the chip example', () => {
    expect(matchOpsCommand('deploy')).toBe('deploys');
    expect(matchOpsCommand('deployments')).toBe('deploys');
    expect(matchOpsCommand('redeploy')).toBe('deploys');
  });

  it('matches other navigable actions', () => {
    expect(matchOpsCommand('settings')).toBe('settings');
    expect(matchOpsCommand('token')).toBe('settings');
    expect(matchOpsCommand('activity')).toBe('activity');
    expect(matchOpsCommand('projects')).toBe('projects');
  });

  it('returns unknown for empty or unrelated text', () => {
    expect(matchOpsCommand('')).toBe('unknown');
    expect(matchOpsCommand('hello')).toBe('unknown');
    expect(rankOpsCommands('hello')).toEqual([]);
  });

  it('ranks multiple hits for a typed fragment', () => {
    const ids = rankOpsCommands('log').map((c) => c.id);
    expect(ids).toContain('logs');
  });

  it('exposes tappable suggestions for the Search tab', () => {
    expect(OPS_COMMAND_SUGGESTIONS.map((s) => s.id)).toContain('issues');
    expect(OPS_COMMAND_SUGGESTIONS.map((s) => s.id)).toContain('deploys');
    expect(OPS_COMMAND_SUGGESTIONS.length).toBeGreaterThanOrEqual(6);
  });

  it('does not list mutators in the Search catalog', () => {
    expect(OPS_COMMAND_CATALOG.map((c) => c.id)).not.toContain('redeploy');
    expect(OPS_COMMAND_CATALOG.map((c) => c.id)).not.toContain('promote');
    expect(OPS_COMMAND_CATALOG.map((c) => c.id)).not.toContain('rollback');
  });
});
