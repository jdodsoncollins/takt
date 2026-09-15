import type { DeploymentState } from '../models/vercelModels';
import { isFailedState, isInFlightState, isSuccessState } from './projectHealth';

export interface PollTick {
  attempt: number;
  state: DeploymentState;
  atMs: number;
}

export interface DeploymentPollResult {
  finalState: DeploymentState;
  attempts: number;
  timedOut: boolean;
  ticks: PollTick[];
  /** True only when Vercel reported READY. */
  isReady: boolean;
  /** True when ERROR/CANCELED (or similar terminal failure). */
  isFailed: boolean;
  /** Terminal state that prevents a successful deployment. */
  isBlocked: boolean;
  summary: string;
}

export function isTerminalDeploymentState(state: DeploymentState): boolean {
  return (
    isSuccessState(state) ||
    isFailedState(state) ||
    state === 'DELETED' ||
    state === 'UNKNOWN'
  );
}

/**
 * Poll deployment until terminal or max attempts.
 * Never treats in-flight as success. Injectable sleep/get for tests.
 */
export async function pollDeploymentUntilTerminal(opts: {
  getState: () => Promise<DeploymentState>;
  sleep?: (ms: number) => Promise<void>;
  intervalMs?: number;
  maxAttempts?: number;
  now?: () => number;
}): Promise<DeploymentPollResult> {
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const intervalMs = opts.intervalMs ?? 3000;
  const maxAttempts = opts.maxAttempts ?? 40;
  const now = opts.now ?? Date.now;
  const ticks: PollTick[] = [];

  let last: DeploymentState = 'UNKNOWN';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await opts.getState();
    ticks.push({ attempt, state: last, atMs: now() });
    if (isTerminalDeploymentState(last) && !isInFlightState(last)) {
      // UNKNOWN alone after first tick is not terminal success — only stop if not in-flight
      if (last === 'UNKNOWN' && attempt < 3) {
        await sleep(intervalMs);
        continue;
      }
      if (last !== 'UNKNOWN' || attempt >= maxAttempts) {
        return finalize(last, attempt, false, ticks);
      }
    }
    if (attempt < maxAttempts) {
      await sleep(intervalMs);
    }
  }
  return finalize(last, maxAttempts, true, ticks);
}

function finalize(
  finalState: DeploymentState,
  attempts: number,
  timedOut: boolean,
  ticks: PollTick[],
): DeploymentPollResult {
  const isReady = isSuccessState(finalState);
  const isBlocked =
    finalState === 'BLOCKED' ||
    finalState === 'DELETED' ||
    finalState === 'UNKNOWN';
  const isFailed = isFailedState(finalState) || isBlocked;
  let summary: string;
  if (timedOut) {
    summary = `Still ${finalState} after ${attempts} poll(s) — not claiming success. Refresh later.`;
  } else if (isReady) {
    summary = `Deployment READY after ${attempts} poll(s) (Vercel confirmed).`;
  } else if (isBlocked) {
    summary = `Deployment was blocked in terminal state ${finalState} after ${attempts} poll(s).`;
  } else if (isFailed) {
    summary = `Deployment ended ${finalState} after ${attempts} poll(s).`;
  } else {
    summary = `Deployment reached ${finalState} after ${attempts} poll(s).`;
  }
  return {
    finalState,
    attempts,
    timedOut,
    ticks,
    isReady,
    isFailed,
    isBlocked,
    summary,
  };
}
