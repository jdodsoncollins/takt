import { describe, expect, it } from 'vitest';
import {
  buildAuthorizeUrl,
  isExactOAuthCallback,
} from '../src/services/auth/oauthPkce';
import { resolveOAuthConfig } from '../src/services/auth/oauthConfig';

describe('oauth config', () => {
  it('returns null without client id', () => {
    expect(resolveOAuthConfig({})).toBeNull();
  });

  it('builds authorize URL with PKCE params', () => {
    const config = resolveOAuthConfig({
      vercelClientId: 'client_abc',
      oauthRedirectUri: 'takt://oauth/callback',
    });
    expect(config).toBeTruthy();
    const url = buildAuthorizeUrl(config!, {
      challenge: 'challenge_xyz',
      state: 'state_123',
    });
    expect(url).toContain('client_id=client_abc');
    expect(url).toContain('code_challenge=challenge_xyz');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).not.toContain('nonce=');
    expect(url).toContain(encodeURIComponent('takt://oauth/callback'));
  });

  it('accepts only the configured callback scheme, host, port, and path', () => {
    expect(
      isExactOAuthCallback(
        'takt://oauth/callback?code=abc',
        'takt://oauth/callback',
      ),
    ).toBe(true);
    expect(
      isExactOAuthCallback(
        'https://oauth/callback?code=abc',
        'takt://oauth/callback',
      ),
    ).toBe(false);
    expect(
      isExactOAuthCallback(
        'takt://oauth/other?code=abc',
        'takt://oauth/callback',
      ),
    ).toBe(false);
  });
});
