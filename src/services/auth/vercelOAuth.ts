import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import type { VercelOAuthConfig } from './oauthConfig';
import {
  buildAuthorizeUrl,
  isExactOAuthCallback,
} from './oauthPkce';

export { buildAuthorizeUrl } from './oauthPkce';

WebBrowser.maybeCompleteAuthSession();

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  tokenType: string | null;
  scope: string | null;
}

function base64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  if (typeof globalThis.btoa === 'function') {
    return globalThis
      .btoa(s)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createPkcePair(): Promise<{
  verifier: string;
  challenge: string;
  state: string;
}> {
  const [verifierBytes, stateBytes] = await Promise.all([
    Crypto.getRandomBytesAsync(32),
    Crypto.getRandomBytesAsync(16),
  ]);
  const verifier = base64Url(verifierBytes);
  const state = base64Url(stateBytes);
  const challenge = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  const challengeUrl = challenge
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { verifier, challenge: challengeUrl, state };
}

export async function startVercelOAuth(
  config: VercelOAuthConfig,
): Promise<OAuthTokenResult> {
  const pkce = await createPkcePair();
  const authUrl = buildAuthorizeUrl(config, pkce);
  const result = await WebBrowser.openAuthSessionAsync(
    authUrl,
    config.redirectUri,
  );
  if (result.type !== 'success' || !('url' in result) || !result.url) {
    throw new Error(
      result.type === 'cancel'
        ? 'OAuth canceled'
        : 'OAuth did not complete successfully',
    );
  }
  const returned = new URL(result.url);
  if (!isExactOAuthCallback(result.url, config.redirectUri)) {
    throw new Error('OAuth callback URL mismatch');
  }
  const err = returned.searchParams.get('error');
  if (err) {
    throw new Error(`OAuth authorization failed (${err})`);
  }
  const code = returned.searchParams.get('code');
  const state = returned.searchParams.get('state');
  if (!code) throw new Error('OAuth callback missing code');
  if (state !== pkce.state) throw new Error('OAuth state mismatch');

  const tokens = await exchangeCodeForToken(config, code, pkce.verifier);
  return tokens;
}

export async function exchangeCodeForToken(
  config: VercelOAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<OAuthTokenResult> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });
  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status})`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };
  if (!data.access_token) {
    throw new Error('Token response missing access_token');
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? null,
    tokenType: data.token_type ?? null,
    scope: data.scope ?? null,
  };
}
