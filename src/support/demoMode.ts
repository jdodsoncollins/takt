/**
 * Screenshot-only fixture path. Off unless Metro inlined
 * EXPO_PUBLIC_TAKT_DEMO_MODE at bundle time. Production EAS must not set it.
 * Live Vercel is never mixed with these fixtures.
 */
export function demoModeEnabled(
  value: string | undefined = process.env.EXPO_PUBLIC_TAKT_DEMO_MODE,
): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export const isDemoMode = demoModeEnabled();
