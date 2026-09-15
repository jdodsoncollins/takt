import { describe, expect, it } from 'vitest';
import {
  buildRuntimeLogReport,
  filterRuntimeLogEntries,
  normalizeRuntimeLogPayload,
  normalizeRuntimeLogRow,
  parseRuntimeLogQuery,
  sinceMorning,
  type RuntimeLogEntry,
} from '../src/domain/analysis/runtimeLogs';

function entry(
  partial: Partial<RuntimeLogEntry> & { message: string },
): RuntimeLogEntry {
  return {
    id: partial.id ?? '1',
    message: partial.message,
    level: partial.level ?? 'error',
    statusCode: partial.statusCode ?? 500,
    path: partial.path ?? '/api/x',
    timestampMs: partial.timestampMs ?? Date.now(),
    source: null,
  };
}

describe('parseRuntimeLogQuery', () => {
  const now = Date.UTC(2026, 6, 16, 15, 0, 0); // 15:00 UTC Jul 16

  it('parses production 5xx since this morning', () => {
    const q = parseRuntimeLogQuery(
      'Show production errors since this morning',
      now,
    );
    expect(q.environment).toBe('production');
    expect(q.statusClass).toBe('5xx');
    expect(q.sinceMs).toBe(sinceMorning(now));
    expect(q.label).toMatch(/morning/i);
  });

  it('parses path filter from /api routes', () => {
    const q = parseRuntimeLogQuery('5xx on /api/checkout last hour', now);
    expect(q.pathContains).toBe('/api/checkout');
    expect(q.sinceMs).toBe(now - 3600_000);
  });

  it('defaults to last 24h 5xx production', () => {
    const q = parseRuntimeLogQuery('errors', now);
    expect(q.environment).toBe('production');
    expect(q.statusClass).toBe('5xx');
  });
});

describe('filterRuntimeLogEntries', () => {
  const now = 1_000_000_000_000;
  const query = parseRuntimeLogQuery('production 5xx last hour', now);

  it('keeps 5xx and drops 200s', () => {
    const filtered = filterRuntimeLogEntries(
      [
        entry({ message: 'boom', statusCode: 500, timestampMs: now - 1000 }),
        entry({
          message: 'ok',
          statusCode: 200,
          level: 'info',
          timestampMs: now - 1000,
        }),
      ],
      query,
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.statusCode).toBe(500);
  });

  it('drops lines outside since window', () => {
    const filtered = filterRuntimeLogEntries(
      [
        entry({
          message: 'old',
          statusCode: 500,
          timestampMs: now - 10 * 3600_000,
        }),
      ],
      query,
    );
    expect(filtered).toHaveLength(0);
  });
});

describe('buildRuntimeLogReport', () => {
  it('does not invent data when unavailable', () => {
    const r = buildRuntimeLogReport({
      query: parseRuntimeLogQuery('errors'),
      deploymentId: null,
      entries: null,
      availability: 'not_enabled',
      note: 'no runtime logs API',
    });
    expect(r.entries).toHaveLength(0);
    expect(r.summary).toMatch(/unavailable/i);
  });

  it('summarizes matches', () => {
    const now = Date.now();
    const r = buildRuntimeLogReport({
      query: parseRuntimeLogQuery('production 5xx last hour', now),
      deploymentId: 'dpl_1',
      entries: [
        entry({
          message: 'fail a',
          path: '/api/a',
          statusCode: 500,
          timestampMs: now - 1000,
        }),
        entry({
          message: 'fail b',
          path: '/api/a',
          statusCode: 502,
          timestampMs: now - 2000,
        }),
      ],
      availability: 'ok',
    });
    expect(r.errorCount).toBe(2);
    expect(r.topPaths[0]?.path).toBe('/api/a');
  });
});

describe('normalizeRuntimeLogRow', () => {
  it('maps common fields', () => {
    const e = normalizeRuntimeLogRow(
      {
        id: 'x',
        message: 'hi',
        statusCode: 503,
        path: '/api/z',
        level: 'error',
        timestamp: '2026-07-16T12:00:00.000Z',
      },
      0,
    );
    expect(e.statusCode).toBe(503);
    expect(e.path).toBe('/api/z');
    expect(e.timestampMs).toBe(Date.parse('2026-07-16T12:00:00.000Z'));
  });

  it('maps nested request and payload fixtures', () => {
    const e = normalizeRuntimeLogRow(
      {
        request: { path: '/api/nested', statusCode: 500 },
        payload: { message: 'nested boom', level: 'error' },
        time: 1_700_000_000,
      },
      1,
    );
    expect(e.path).toBe('/api/nested');
    expect(e.statusCode).toBe(500);
    expect(e.message).toMatch(/nested boom/);
  });
});

describe('normalizeRuntimeLogPayload', () => {
  it('parses NDJSON strings', () => {
    const rows = normalizeRuntimeLogPayload(
      '{"message":"a","statusCode":500}\n{"message":"b","status":502}\n',
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]?.statusCode).toBe(502);
  });
});

