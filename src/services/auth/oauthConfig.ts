/**
 * Vercel OAuth (Sign in with Vercel / API OAuth) — public client + PKCE.
 * Configure via app.json extra or env; PAT remains supported as fallback.
 *
 * @see https://vercel.com/docs/sign-in-with-vercel/authorization-server-api
 */

export interface VercelOAuthConfig {
  clientId: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  /** Space-separated scopes when using API OAuth integrations. */
  scope: string;
}

const DEFAULT_AUTHORIZE = 'https://vercel.com/oauth/authorize';
const DEFAULT_TOKEN = 'https://api.vercel.com/login/oauth/token';

/** Read from Expo Constants extra when available; safe defaults for setup UI. */
export function resolveOAuthConfig(extra?: {
  vercelClientId?: string;
  oauthRedirectUri?: string;
  vercelOAuthScope?: string;
}): VercelOAuthConfig | null {
  const clientId =
    extra?.vercelClientId?.trim() ||
    (typeof process !== 'undefined'
      ? process.env.EXPO_PUBLIC_VERCEL_CLIENT_ID?.trim()
      : undefined) ||
    '';
  if (!clientId) return null;

  const redirectUri =
    extra?.oauthRedirectUri?.trim() ||
    (typeof process !== 'undefined'
      ? process.env.EXPO_PUBLIC_VERCEL_REDIRECT_URI?.trim()
      : undefined) ||
    'takt://oauth/callback';

  return {
    clientId,
    redirectUri,
    authorizeUrl: DEFAULT_AUTHORIZE,
    tokenUrl: DEFAULT_TOKEN,
    scope:
      extra?.vercelOAuthScope?.trim() ||
      'offline_access',
  };
}
