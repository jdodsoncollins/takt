import type { VercelOAuthConfig } from './oauthConfig';

/** Pure URL builder — safe for unit tests without RN/WebBrowser. */
export function buildAuthorizeUrl(
  config: VercelOAuthConfig,
  pkce: { challenge: string; state: string },
): string {
  const u = new URL(config.authorizeUrl);
  u.searchParams.set('client_id', config.clientId);
  u.searchParams.set('redirect_uri', config.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', config.scope);
  u.searchParams.set('state', pkce.state);
  u.searchParams.set('code_challenge', pkce.challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

export function isExactOAuthCallback(
  returnedUrl: string,
  redirectUri: string,
): boolean {
  try {
    const returned = new URL(returnedUrl);
    const expected = new URL(redirectUri);
    return (
      returned.protocol === expected.protocol &&
      returned.hostname === expected.hostname &&
      returned.port === expected.port &&
      returned.pathname === expected.pathname &&
      returned.username === expected.username &&
      returned.password === expected.password
    );
  } catch {
    return false;
  }
}
