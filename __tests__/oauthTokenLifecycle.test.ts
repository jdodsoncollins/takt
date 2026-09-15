import { describe, expect, it, vi } from 'vitest';
import { resolveOAuthConfig } from '../src/services/auth/oauthConfig';
import { createRefreshingTokenProvider } from '../src/services/auth/oauthTokenLifecycle';
import {
  clearAccessToken,
  loadAccessToken,
  loadStoredCredentialRecord,
  loadTokenSource,
  MemoryTokenStore,
  persistAccessToken,
  restoreCredentialIfCurrent,
  TokenStoreKeys,
} from '../src/services/auth/tokenStore';

describe('OAuth token lifecycle', () => {
  it('preserves the OAuth source when hydration persists the same token', async () => {
    const store = new MemoryTokenStore();
    await persistAccessToken(store, 'access', {
      source: 'oauth',
      refreshToken: 'refresh',
      expiresIn: 3600,
      nowMs: 1_000,
    });
    await persistAccessToken(store, 'access', { source: 'pat' });
    expect(await loadTokenSource(store)).toBe('oauth');
    expect(await store.load(TokenStoreKeys.refreshToken)).toBe('refresh');
  });

  it('clears prior OAuth rotation state when a newer login has no refresh token', async () => {
    const store = new MemoryTokenStore();
    await persistAccessToken(store, 'old-access', {
      source: 'oauth',
      refreshToken: 'old-refresh',
      expiresIn: 3600,
      nowMs: 0,
    });
    await persistAccessToken(store, 'new-access', {
      source: 'oauth',
      refreshToken: null,
      expiresIn: null,
    });

    expect(await store.load(TokenStoreKeys.refreshToken)).toBeNull();
    expect(await store.load(TokenStoreKeys.accessTokenExpiresAt)).toBeNull();
  });

  it('serializes expiry refresh and persists rotated tokens', async () => {
    const store = new MemoryTokenStore();
    await persistAccessToken(store, 'expired', {
      source: 'oauth',
      refreshToken: 'old-refresh',
      expiresIn: 1,
      nowMs: 0,
    });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const provider = createRefreshingTokenProvider(
      store,
      resolveOAuthConfig({ vercelClientId: 'client' })!,
      { fetchImpl, now: () => 10_000 },
    );
    await expect(Promise.all([provider(), provider(), provider()])).resolves.toEqual([
      'new-access',
      'new-access',
      'new-access',
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await store.load(TokenStoreKeys.refreshToken)).toBe('new-refresh');
  });

  it.each([
    {
      name: 'disconnect or erase',
      replace: (store: MemoryTokenStore) => clearAccessToken(store),
      expected: null,
      source: null,
    },
    {
      name: 'PAT replacement',
      replace: (store: MemoryTokenStore) =>
        persistAccessToken(store, 'pat-access', { source: 'pat' }),
      expected: 'pat-access',
      source: 'pat',
    },
    {
      name: 'newer OAuth login',
      replace: (store: MemoryTokenStore) =>
        persistAccessToken(store, 'newer-oauth', {
          source: 'oauth',
          refreshToken: 'newer-refresh',
          expiresIn: 3600,
          nowMs: 10_000,
        }),
      expected: 'newer-oauth',
      source: 'oauth',
    },
  ])('does not persist a stale refresh after $name', async ({ replace, expected, source }) => {
    const store = new MemoryTokenStore();
    await persistAccessToken(store, 'expired', {
      source: 'oauth',
      refreshToken: 'old-refresh',
      expiresIn: 1,
      nowMs: 0,
    });
    let resolveRefresh!: (response: Response) => void;
    const fetchImpl = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    const provider = createRefreshingTokenProvider(
      store,
      resolveOAuthConfig({ vercelClientId: 'client' })!,
      { fetchImpl, now: () => 10_000 },
    );

    const pending = provider();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    await replace(store);
    resolveRefresh(
      new Response(
        JSON.stringify({
          access_token: 'stale-access',
          refresh_token: 'stale-refresh',
          expires_in: 3600,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(pending).resolves.toBe(expected);
    expect(await loadAccessToken(store)).toBe(expected);
    expect(await loadTokenSource(store)).toBe(source);
    expect(await store.load(TokenStoreKeys.refreshToken)).not.toBe('stale-refresh');
  });

  it('restores the complete previous credential after a failed PAT connection', async () => {
    const store = new MemoryTokenStore();
    await persistAccessToken(store, 'old-access', {
      source: 'oauth',
      refreshToken: 'old-refresh',
      expiresIn: 3600,
      nowMs: 1_000,
    });
    const previous = await loadStoredCredentialRecord(store);
    const candidate = await persistAccessToken(store, 'candidate-pat', {
      source: 'pat',
    });

    await expect(
      restoreCredentialIfCurrent(store, candidate, previous),
    ).resolves.toBe(true);
    expect(await loadStoredCredentialRecord(store)).toMatchObject({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      accessTokenExpiresAt: previous.accessTokenExpiresAt,
      tokenSource: 'oauth',
    });
  });

  it('does not restore a failed PAT candidate over a newer credential', async () => {
    const store = new MemoryTokenStore();
    await persistAccessToken(store, 'old', { source: 'pat' });
    const previous = await loadStoredCredentialRecord(store);
    const candidate = await persistAccessToken(store, 'candidate', { source: 'pat' });
    await persistAccessToken(store, 'newer', { source: 'pat' });

    await expect(
      restoreCredentialIfCurrent(store, candidate, previous),
    ).resolves.toBe(false);
    expect(await loadAccessToken(store)).toBe('newer');
  });
});
