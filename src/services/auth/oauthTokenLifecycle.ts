import type { VercelOAuthConfig } from './oauthConfig';
import {
  loadAccessToken,
  loadOAuthTokenRecord,
  replaceOAuthTokenIfCurrent,
  type TokenStore,
} from './tokenStore';

export async function refreshVercelOAuthToken(
  config: VercelOAuthConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number | null;
}> {
  const res = await fetchImpl(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`);
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token || !data.refresh_token) {
    throw new Error('Token refresh response is invalid');
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? null,
  };
}

export function createRefreshingTokenProvider(
  store: TokenStore,
  config: VercelOAuthConfig,
  opts?: {
    fetchImpl?: typeof fetch;
    now?: () => number;
    refreshLeewayMs?: number;
  },
): () => Promise<string | null> {
  let refreshInFlight: Promise<string | null> | null = null;
  const now = opts?.now ?? Date.now;
  const leeway = opts?.refreshLeewayMs ?? 60_000;

  return async () => {
    const record = await loadOAuthTokenRecord(store);
    if (!record) return loadAccessToken(store);
    if (record.expiresAt == null || record.expiresAt > now() + leeway) {
      return record.accessToken;
    }
    if (!record.refreshToken) return null;
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const tokens = await refreshVercelOAuthToken(
          config,
          record.refreshToken!,
          opts?.fetchImpl,
        );
        const persisted = await replaceOAuthTokenIfCurrent(store, {
          accessToken: record.accessToken,
          refreshToken: record.refreshToken,
          accessTokenExpiresAt:
            record.expiresAt == null ? null : String(record.expiresAt),
          tokenSource: 'oauth',
          generation: record.generation,
        }, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          nowMs: now(),
        });
        return persisted ? tokens.accessToken : loadAccessToken(store);
      })().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  };
}
