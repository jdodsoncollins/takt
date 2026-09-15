/** Visual tone for deployment / activity states. Domain strings stay unchanged. */
export type ConsoleStateTone = 'ready' | 'building' | 'error' | 'neutral';

export function deploymentStateTone(state: string): ConsoleStateTone {
  if (state === 'READY') return 'ready';
  if (state === 'ERROR' || state === 'CANCELED' || state === 'BLOCKED') {
    return 'error';
  }
  if (
    state === 'BUILDING' ||
    state === 'QUEUED' ||
    state === 'INITIALIZING'
  ) {
    return 'building';
  }
  return 'neutral';
}

export function outcomeTone(
  outcome: string,
): ConsoleStateTone {
  if (outcome === 'success') return 'ready';
  if (outcome === 'failure') return 'error';
  return 'neutral';
}
