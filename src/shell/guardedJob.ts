import type { MutableRefObject } from 'react';

export async function runGuardedJob(
  generationRef: MutableRefObject<number>,
  setBusyKey: (key: string | null) => void,
  setLastError: (message: string | null) => void,
  busyKey: string,
  work: (stillCurrent: () => boolean) => Promise<void>,
): Promise<void> {
  const generation = generationRef.current;
  const stillCurrent = () => generation === generationRef.current;
  setBusyKey(busyKey);
  setLastError(null);
  try {
    await work(stillCurrent);
  } catch (error) {
    if (stillCurrent()) {
      setLastError(error instanceof Error ? error.message : String(error));
    }
  } finally {
    if (stillCurrent()) setBusyKey(null);
  }
}
