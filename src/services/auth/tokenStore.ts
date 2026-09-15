const STORE_PREFIX = (process.env.EXPO_PUBLIC_BUNDLE_ID || 'takt').trim() || 'takt';

export const TokenStoreKeys = {
  accessToken: `${STORE_PREFIX}.accessToken`,
  refreshToken: `${STORE_PREFIX}.refreshToken`,
  accessTokenExpiresAt: `${STORE_PREFIX}.accessTokenExpiresAt`,
  tokenSource: `${STORE_PREFIX}.tokenSource`,
  credentialGeneration: `${STORE_PREFIX}.credentialGeneration`,
  selectedTeamId: `${STORE_PREFIX}.selectedTeamId`,
  selectedProjectId: `${STORE_PREFIX}.selectedProjectId`,
} as const;

export type TokenSource = 'pat' | 'oauth';

export interface TokenStore {
  save(key: string, value: string): Promise<void>;
  load(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

export interface StoredCredentialRecord {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  tokenSource: TokenSource | null;
  generation: number;
}

const credentialWrites = new WeakMap<TokenStore, Promise<void>>();

function serializeCredentialWrite<T>(
  store: TokenStore,
  work: () => Promise<T>,
): Promise<T> {
  const previous = credentialWrites.get(store) ?? Promise.resolve();
  const result = previous.then(work, work);
  credentialWrites.set(store, result.then(() => undefined, () => undefined));
  return result;
}

export class MemoryTokenStore implements TokenStore {
  private readonly map = new Map<string, string>();

  async save(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async load(key: string): Promise<string | null> {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

export async function persistAccessToken(
  store: TokenStore,
  token: string,
  opts?: {
    source?: TokenSource;
    refreshToken?: string | null;
    expiresIn?: number | null;
    nowMs?: number;
  },
): Promise<StoredCredentialRecord> {
  return serializeCredentialWrite(store, async () => {
    const trimmed = token.trim();
    if (!trimmed) return clearAccessTokenUnlocked(store);
    const existing = await loadStoredCredentialRecordUnlocked(store);
    const preserveOAuthSource =
      existing.accessToken?.trim() === trimmed &&
      existing.tokenSource === 'oauth' &&
      opts?.source === 'pat';
    const expiresIn =
      opts?.expiresIn ??
      (opts?.source === 'oauth' && opts.refreshToken ? 60 * 60 : null);
    const next: StoredCredentialRecord = {
      accessToken: trimmed,
      refreshToken:
        opts?.source === 'oauth'
          ? opts.refreshToken?.trim() || null
          : opts?.source === 'pat' && !preserveOAuthSource
            ? null
            : existing.refreshToken,
      accessTokenExpiresAt:
        expiresIn != null && Number.isFinite(expiresIn)
          ? String((opts?.nowMs ?? Date.now()) + Math.max(0, expiresIn) * 1000)
          : opts?.source === 'oauth' ||
              (opts?.source === 'pat' && !preserveOAuthSource)
            ? null
            : existing.accessTokenExpiresAt,
      tokenSource: preserveOAuthSource
        ? existing.tokenSource
        : (opts?.source ?? 'pat'),
      generation: existing.generation + 1,
    };
    await writeStoredCredentialRecord(store, next);
    return next;
  });
}

export async function loadAccessToken(
  store: TokenStore,
): Promise<string | null> {
  const t = await store.load(TokenStoreKeys.accessToken);
  if (!t || !t.trim()) return null;
  return t.trim();
}

export async function loadTokenSource(
  store: TokenStore,
): Promise<TokenSource | null> {
  const s = await store.load(TokenStoreKeys.tokenSource);
  if (s === 'oauth' || s === 'pat') return s;
  return null;
}

export async function loadOAuthTokenRecord(store: TokenStore): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  generation: number;
} | null> {
  const stored = await loadStoredCredentialRecord(store);
  if (stored.tokenSource !== 'oauth') return null;
  const accessToken = stored.accessToken?.trim();
  if (!accessToken) return null;
  const refreshToken = stored.refreshToken;
  const rawExpiresAt = stored.accessTokenExpiresAt;
  const expiresAt = rawExpiresAt == null ? null : Number(rawExpiresAt);
  return {
    accessToken,
    refreshToken: refreshToken?.trim() || null,
    expiresAt: expiresAt != null && Number.isFinite(expiresAt) ? expiresAt : null,
    generation: stored.generation,
  };
}

export function loadStoredCredentialRecord(
  store: TokenStore,
): Promise<StoredCredentialRecord> {
  const pending = credentialWrites.get(store) ?? Promise.resolve();
  return pending.then(() => loadStoredCredentialRecordUnlocked(store));
}

export async function replaceOAuthTokenIfCurrent(
  store: TokenStore,
  expected: StoredCredentialRecord,
  next: { accessToken: string; refreshToken: string; expiresIn: number | null; nowMs: number },
): Promise<boolean> {
  return serializeCredentialWrite(store, async () => {
    const current = await loadStoredCredentialRecordUnlocked(store);
    if (!sameCredential(current, expected) || current.tokenSource !== 'oauth') {
      return false;
    }
    const replacement: StoredCredentialRecord = {
      accessToken: next.accessToken.trim(),
      refreshToken: next.refreshToken.trim(),
      accessTokenExpiresAt:
        next.expiresIn != null && Number.isFinite(next.expiresIn)
          ? String(next.nowMs + Math.max(0, next.expiresIn) * 1000)
          : current.accessTokenExpiresAt,
      tokenSource: 'oauth',
      generation: current.generation + 1,
    };
    await writeStoredCredentialRecord(store, replacement);
    return true;
  });
}

export async function restoreCredentialIfCurrent(
  store: TokenStore,
  expected: StoredCredentialRecord,
  previous: StoredCredentialRecord,
): Promise<boolean> {
  return serializeCredentialWrite(store, async () => {
    const current = await loadStoredCredentialRecordUnlocked(store);
    if (!sameCredential(current, expected)) return false;
    await writeStoredCredentialRecord(store, {
      ...previous,
      generation: current.generation + 1,
    });
    return true;
  });
}

export function clearAccessToken(store: TokenStore): Promise<StoredCredentialRecord> {
  return serializeCredentialWrite(store, () => clearAccessTokenUnlocked(store));
}

async function clearAccessTokenUnlocked(
  store: TokenStore,
): Promise<StoredCredentialRecord> {
  const current = await loadStoredCredentialRecordUnlocked(store);
  const cleared: StoredCredentialRecord = {
    accessToken: null,
    refreshToken: null,
    accessTokenExpiresAt: null,
    tokenSource: null,
    generation: current.generation + 1,
  };
  await writeStoredCredentialRecord(store, cleared);
  return cleared;
}

async function loadStoredCredentialRecordUnlocked(
  store: TokenStore,
): Promise<StoredCredentialRecord> {
  const [accessToken, refreshToken, accessTokenExpiresAt, source, rawGeneration] =
    await Promise.all([
      store.load(TokenStoreKeys.accessToken),
      store.load(TokenStoreKeys.refreshToken),
      store.load(TokenStoreKeys.accessTokenExpiresAt),
      store.load(TokenStoreKeys.tokenSource),
      store.load(TokenStoreKeys.credentialGeneration),
    ]);
  const generation = Number(rawGeneration);
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    tokenSource: source === 'oauth' || source === 'pat' ? source : null,
    generation: Number.isSafeInteger(generation) && generation >= 0 ? generation : 0,
  };
}

async function writeStoredCredentialRecord(
  store: TokenStore,
  record: StoredCredentialRecord,
): Promise<void> {
  const fields: Array<[string, string | null]> = [
    [TokenStoreKeys.accessToken, record.accessToken],
    [TokenStoreKeys.refreshToken, record.refreshToken],
    [TokenStoreKeys.accessTokenExpiresAt, record.accessTokenExpiresAt],
    [TokenStoreKeys.tokenSource, record.tokenSource],
  ];
  await Promise.all(
    fields.map(([key, value]) =>
      value == null ? store.delete(key) : store.save(key, value),
    ),
  );
  await store.save(TokenStoreKeys.credentialGeneration, String(record.generation));
}

function sameCredential(
  left: StoredCredentialRecord,
  right: StoredCredentialRecord,
): boolean {
  return (
    left.generation === right.generation &&
    left.accessToken === right.accessToken &&
    left.refreshToken === right.refreshToken &&
    left.accessTokenExpiresAt === right.accessTokenExpiresAt &&
    left.tokenSource === right.tokenSource
  );
}
