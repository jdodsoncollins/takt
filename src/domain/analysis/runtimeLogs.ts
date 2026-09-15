/**
 * Validated runtime-log query plans — no arbitrary filters from free text.
 * NL maps into this shape only (see parseRuntimeLogQuery).
 */

export type RuntimeEnvironment = 'production' | 'preview';

export type RuntimeStatusClass = '5xx' | '4xx' | 'all';

export type RuntimeLogLevel = 'error' | 'warning' | 'info' | 'fatal';

export interface RuntimeLogQuery {
  /** Target environment when choosing a deployment if none selected. */
  environment: RuntimeEnvironment;
  /** Inclusive lower bound (epoch ms). */
  sinceMs: number;
  /** Exclusive upper bound; null = now. */
  untilMs: number | null;
  statusClass: RuntimeStatusClass;
  levels: RuntimeLogLevel[] | null;
  /** Substring match on path/route when present. */
  pathContains: string | null;
  limit: number;
  /** Human label for UI/activity. */
  label: string;
}

export interface RuntimeLogEntry {
  id: string;
  message: string;
  level: string | null;
  statusCode: number | null;
  path: string | null;
  timestampMs: number | null;
  source: string | null;
}

export interface RuntimeLogReport {
  query: RuntimeLogQuery;
  deploymentId: string | null;
  availability:
    | 'ok'
    | 'no_data'
    | 'not_enabled'
    | 'unavailable_for_plan'
    | 'temporarily_unavailable';
  entries: RuntimeLogEntry[];
  summary: string;
  bullets: string[];
  topPaths: { path: string; count: number }[];
  errorCount: number;
  note?: string;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/** Presets relative to `nowMs`. */
export function sinceMorning(nowMs: number, timeZoneOffsetMinutes = 0): number {
  const local = new Date(nowMs - timeZoneOffsetMinutes * 60_000);
  const start = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  return start + timeZoneOffsetMinutes * 60_000;
}

/**
 * Map natural language / assistant phrases into a validated query.
 * Unknown phrases fall back to production 5xx last 24h.
 */
export function parseRuntimeLogQuery(
  text: string,
  nowMs: number = Date.now(),
): RuntimeLogQuery {
  const q = text.trim().toLowerCase();
  let environment: RuntimeEnvironment = 'production';
  if (q.includes('preview')) environment = 'preview';

  let sinceMs = nowMs - 24 * 3600_000;
  let label = 'Production errors (last 24h)';

  if (q.includes('this morning') || q.includes('since morning')) {
    sinceMs = sinceMorning(nowMs);
    label = 'Production errors since this morning';
  } else if (q.includes('last hour') || q.includes('past hour') || q.includes('1h')) {
    sinceMs = nowMs - 3600_000;
    label = 'Production errors (last hour)';
  } else if (q.includes('last 7') || q.includes('past week') || q.includes('7d')) {
    sinceMs = nowMs - 7 * 24 * 3600_000;
    label = 'Production errors (last 7d)';
  } else if (q.includes('since deploy') || q.includes('after deploy')) {
    // Caller may tighten sinceMs to deployment readyAt; default 6h window.
    sinceMs = nowMs - 6 * 3600_000;
    label = 'Errors since recent deploy (approx 6h)';
  }

  let statusClass: RuntimeStatusClass = '5xx';
  if (q.includes('4xx') || q.includes('client error')) statusClass = '4xx';
  if (q.includes('all status') || q.includes('any status')) statusClass = 'all';
  if (
    !q.includes('5xx') &&
    !q.includes('4xx') &&
    (q.includes('error') || q.includes('fail') || q.includes('500'))
  ) {
    statusClass = '5xx';
  }

  let levels: RuntimeLogLevel[] | null = ['error', 'fatal'];
  if (q.includes('warning') || q.includes('warn')) {
    levels = ['error', 'fatal', 'warning'];
  }
  if (q.includes('info log') || q.includes('all levels')) {
    levels = null;
  }

  let pathContains: string | null = null;
  const pathMatch = q.match(/(?:path|route)\s+(\/[a-z0-9/_-]*)/i);
  if (pathMatch?.[1]) pathContains = pathMatch[1];
  const apiMatch = q.match(/(\/api\/[a-z0-9/_-]*)/i);
  if (apiMatch?.[1]) pathContains = apiMatch[1];

  if (environment === 'preview') {
    label = label.replace(/^Production/, 'Preview');
  }

  return {
    environment,
    sinceMs,
    untilMs: null,
    statusClass,
    levels,
    pathContains,
    limit: DEFAULT_LIMIT,
    label,
  };
}

export function clampRuntimeLogQuery(query: RuntimeLogQuery): RuntimeLogQuery {
  return {
    ...query,
    limit: Math.min(MAX_LIMIT, Math.max(1, Math.floor(query.limit))),
    sinceMs: Math.min(query.sinceMs, Date.now()),
  };
}

export function filterRuntimeLogEntries(
  entries: RuntimeLogEntry[],
  query: RuntimeLogQuery,
): RuntimeLogEntry[] {
  const until = query.untilMs ?? Number.POSITIVE_INFINITY;
  return entries.filter((e) => {
    if (e.timestampMs != null) {
      if (e.timestampMs < query.sinceMs || e.timestampMs >= until) return false;
    }
    if (query.statusClass === '5xx') {
      if (e.statusCode == null || e.statusCode < 500 || e.statusCode > 599) {
        // keep level-based errors without status
        if (!isErrorLevel(e.level)) return false;
      }
    } else if (query.statusClass === '4xx') {
      if (e.statusCode == null || e.statusCode < 400 || e.statusCode > 499) {
        return false;
      }
    }
    if (query.levels && query.levels.length > 0) {
      const lvl = (e.level ?? '').toLowerCase();
      if (lvl && !query.levels.some((l) => lvl.includes(l))) {
        // If level present and not matching, drop; if missing, keep for 5xx status hits
        if (e.statusCode == null) return false;
      }
    }
    if (query.pathContains) {
      const p = e.path ?? '';
      if (!p.toLowerCase().includes(query.pathContains.toLowerCase())) {
        return false;
      }
    }
    return true;
  });
}

function isErrorLevel(level: string | null): boolean {
  if (!level) return false;
  const l = level.toLowerCase();
  return l.includes('error') || l.includes('fatal') || l.includes('exception');
}

export function buildRuntimeLogReport(input: {
  query: RuntimeLogQuery;
  deploymentId: string | null;
  entries: RuntimeLogEntry[] | null;
  availability: RuntimeLogReport['availability'];
  note?: string;
}): RuntimeLogReport {
  const query = clampRuntimeLogQuery(input.query);
  if (input.availability !== 'ok' || input.entries == null) {
    return {
      query,
      deploymentId: input.deploymentId,
      availability: input.availability,
      entries: [],
      summary: `${query.label}: unavailable (${input.availability})`,
      bullets: [
        input.note ??
          'Runtime logs are not available for this project/deployment or token scope.',
      ],
      topPaths: [],
      errorCount: 0,
      note: input.note,
    };
  }

  const filtered = filterRuntimeLogEntries(input.entries, query).slice(
    0,
    query.limit,
  );
  const pathCounts = new Map<string, number>();
  let errorCount = 0;
  for (const e of filtered) {
    if (
      (e.statusCode != null && e.statusCode >= 500) ||
      isErrorLevel(e.level)
    ) {
      errorCount += 1;
    }
    const p = e.path ?? '(unknown path)';
    pathCounts.set(p, (pathCounts.get(p) ?? 0) + 1);
  }
  const topPaths = [...pathCounts.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const bullets: string[] = [
    `Matched ${filtered.length} log line(s) (error-like: ${errorCount})`,
  ];
  for (const t of topPaths.slice(0, 3)) {
    bullets.push(`${t.count}× ${t.path}`);
  }
  for (const e of filtered.slice(0, 5)) {
    const code = e.statusCode != null ? ` ${e.statusCode}` : '';
    const path = e.path ? ` ${e.path}` : '';
    bullets.push(
      `${e.message.slice(0, 120)}${code}${path}`.trim() || '(empty message)',
    );
  }
  if (filtered.length === 0) {
    bullets.push('No lines matched the validated filters in this window.');
  }

  return {
    query,
    deploymentId: input.deploymentId,
    availability: filtered.length === 0 ? 'no_data' : 'ok',
    entries: filtered,
    summary:
      filtered.length === 0
        ? `${query.label}: no matching lines`
        : `${query.label}: ${errorCount} error-like of ${filtered.length} lines`,
    bullets,
    topPaths,
    errorCount,
  };
}

/** Map heterogeneous API log rows into RuntimeLogEntry. */
export function normalizeRuntimeLogRow(
  raw: Record<string, unknown>,
  index: number,
): RuntimeLogEntry {
  const nested =
    raw.request && typeof raw.request === 'object'
      ? (raw.request as Record<string, unknown>)
      : raw.proxy && typeof raw.proxy === 'object'
        ? (raw.proxy as Record<string, unknown>)
        : null;
  const payload =
    raw.payload && typeof raw.payload === 'object'
      ? (raw.payload as Record<string, unknown>)
      : null;

  const message =
    str(raw.message) ??
    str(raw.text) ??
    str(raw.msg) ??
    str(payload?.text) ??
    str(payload?.message) ??
    (payload ? JSON.stringify(payload).slice(0, 200) : null) ??
    '';
  const statusCode =
    num(raw.responseStatusCode) ??
    num(raw.statusCode) ??
    num(raw.status) ??
    num(nested?.statusCode) ??
    num(nested?.status) ??
    num(payload?.statusCode);
  const path =
    str(raw.path) ??
    str(raw.requestPath) ??
    str(raw.route) ??
    str(raw.pathname) ??
    str(nested?.path) ??
    str(nested?.url) ??
    str(payload?.path);
  const ts =
    num(raw.timestampInMs) ??
    num(raw.timestampMs) ??
    num(raw.TimeUnixNano) ??
    num(raw.time) ??
    (typeof raw.timestamp === 'string'
      ? Date.parse(raw.timestamp)
      : num(raw.timestamp)) ??
    (typeof raw.date === 'string' ? Date.parse(raw.date) : null) ??
    num(raw.created) ??
    num(payload?.timestamp);
  let timestampMs: number | null =
    ts != null && Number.isFinite(ts) ? ts : null;
  // ns → ms
  if (timestampMs != null && timestampMs > 1e16) {
    timestampMs = Math.floor(timestampMs / 1e6);
  } else if (timestampMs != null && timestampMs > 1e14) {
    timestampMs = Math.floor(timestampMs / 1e6);
  } else if (timestampMs != null && timestampMs < 1e11) {
    // seconds
    timestampMs = timestampMs * 1000;
  }

  return {
    id: str(raw.rowId) ?? str(raw.id) ?? str(raw.requestId) ?? `log_${index}`,
    message,
    level: str(raw.level) ?? str(raw.severity) ?? str(raw.type) ?? str(payload?.level),
    statusCode,
    path,
    timestampMs,
    source: str(raw.source) ?? str(raw.branch) ?? str(nested?.host),
  };
}

/** Normalize NDJSON / array / {logs} fixtures for tests and soft API shapes. */
export function normalizeRuntimeLogPayload(data: unknown): RuntimeLogEntry[] {
  const rows = extractRows(data);
  return rows.map((r, i) => normalizeRuntimeLogRow(r, i));
}

function extractRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(
      (x): x is Record<string, unknown> => typeof x === 'object' && x != null,
    );
  }
  if (typeof data === 'string') {
    // NDJSON
    return data
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>;
        } catch {
          return { message: l };
        }
      });
  }
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    for (const key of ['logs', 'data', 'rows', 'items', 'events', 'result']) {
      if (Array.isArray(o[key])) {
        return (o[key] as unknown[]).filter(
          (x): x is Record<string, unknown> =>
            typeof x === 'object' && x != null,
        );
      }
    }
  }
  return [];
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}
