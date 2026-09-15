import { describe, expect, it, vi } from 'vitest';
import {
  isTerminalDeploymentState,
  pollDeploymentUntilTerminal,
} from '../src/domain/analysis/deploymentPoll';
import type { DeploymentState } from '../src/domain/models/vercelModels';

describe('isTerminalDeploymentState', () => {
  it('treats READY and ERROR as terminal', () => {
    expect(isTerminalDeploymentState('READY')).toBe(true);
    expect(isTerminalDeploymentState('ERROR')).toBe(true);
    expect(isTerminalDeploymentState('BUILDING')).toBe(false);
    expect(isTerminalDeploymentState('QUEUED')).toBe(false);
  });
});

describe('pollDeploymentUntilTerminal', () => {
  it('returns READY without claiming early', async () => {
    const states: DeploymentState[] = ['BUILDING', 'BUILDING', 'READY'];
    let i = 0;
    const result = await pollDeploymentUntilTerminal({
      getState: async () => states[Math.min(i++, states.length - 1)]!,
      sleep: async () => {},
      intervalMs: 1,
      maxAttempts: 10,
      now: () => 0,
    });
    expect(result.isReady).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.summary).toMatch(/READY/);
  });

  it('records failure terminal states', async () => {
    const result = await pollDeploymentUntilTerminal({
      getState: async () => 'ERROR',
      sleep: async () => {},
      maxAttempts: 5,
    });
    expect(result.isFailed).toBe(true);
    expect(result.isReady).toBe(false);
  });

  it('models a deleted deployment as blocked terminal failure', async () => {
    const result = await pollDeploymentUntilTerminal({
      getState: async () => 'DELETED',
      sleep: async () => {},
    });
    expect(result.isBlocked).toBe(true);
    expect(result.isFailed).toBe(true);
    expect(result.summary).toMatch(/blocked/);
  });

  it('models Vercel BLOCKED as a blocked terminal failure', async () => {
    const result = await pollDeploymentUntilTerminal({
      getState: async () => 'BLOCKED',
      sleep: async () => {},
    });
    expect(result.finalState).toBe('BLOCKED');
    expect(result.isBlocked).toBe(true);
    expect(result.isFailed).toBe(true);
  });

  it('times out without claiming success', async () => {
    const getState = vi.fn().mockResolvedValue('BUILDING' as DeploymentState);
    const result = await pollDeploymentUntilTerminal({
      getState,
      sleep: async () => {},
      maxAttempts: 3,
      intervalMs: 1,
    });
    expect(result.timedOut).toBe(true);
    expect(result.isReady).toBe(false);
    expect(result.summary).toMatch(/not claiming success/i);
    expect(getState).toHaveBeenCalledTimes(3);
  });
});
