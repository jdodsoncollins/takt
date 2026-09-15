/**
 * App Intent deep links. Native Swift App Intents open these URLs;
 * Expo Router maps them to screens. Intents never mutate Vercel state.
 */
export const TAKT_APP_INTENT_PATHS = {
  home: '/home',
  deployments: '/deployments',
  activity: '/activity',
  assistant: '/search',
  settings: '/settings',
} as const;

export type TaktAppIntent = keyof typeof TAKT_APP_INTENT_PATHS;

const SCHEME = (process.env.EXPO_PUBLIC_SCHEME || 'takt').trim() || 'takt';

export function taktAppIntentUrl(intent: TaktAppIntent): string {
  return `${SCHEME}:/${TAKT_APP_INTENT_PATHS[intent]}`;
}
