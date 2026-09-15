import { describe, expect, it } from 'vitest';
import { buildBoundedOpsContext } from '../src/domain/analysis/opsNarrative';
import {
  buildOpsRouteJsonSchema,
  buildOpsRoutePrompt,
  OPS_ROUTE_ANSWER,
  routeOpsQuery,
  sanitizeOpsRoute,
  type OpsRouteCatalogItem,
  type OpsRouterBackend,
} from '../src/domain/analysis/opsRouter';
import { OPS_COMMAND_CATALOG } from '../src/features/command/opsCommands';

const catalog: OpsRouteCatalogItem[] = OPS_COMMAND_CATALOG.map((cmd) => ({
  id: cmd.id,
  label: cmd.label,
  description: cmd.example,
}));

const catalogIds = new Set(catalog.map((c) => c.id));

const ctx = buildBoundedOpsContext({
  projectName: 'shop',
  productionState: 'READY',
});

function backendReturning(
  payload: unknown,
  kind: OpsRouterBackend['kind'] = 'apple-foundation',
): OpsRouterBackend {
  return {
    kind,
    generateStructured: async () => payload,
  };
}

describe('opsRouter', () => {
  it('builds an enum of catalog ids plus answer, without mutators', () => {
    const schema = buildOpsRouteJsonSchema(catalog.map((c) => c.id));
    const actions = schema.properties.action.enum;
    expect(actions).toContain('deploys');
    expect(actions).toContain('issues');
    expect(actions).toContain(OPS_ROUTE_ANSWER);
    expect(actions).not.toContain('redeploy');
    expect(actions).not.toContain('promote');
    expect(actions).not.toContain('rollback');
    expect(actions).not.toContain('unknown');
  });

  it('keeps prompts bounded: query + catalog + context, no tokens', () => {
    const prompt = buildOpsRoutePrompt('deploy', ctx, catalog);
    expect(prompt).toMatch(/deploy/);
    expect(prompt).toMatch(/deploys/);
    expect(prompt).toMatch(/shop/);
    expect(prompt).toMatch(/widgets in place/i);
    expect(prompt).not.toMatch(/vcp_|sk_live|vercel_/);
  });

  it('returns unavailable without a backend', async () => {
    const result = await routeOpsQuery('deploy', ctx, catalog, null);
    expect(result).toEqual({ ok: false, error: 'unavailable' });
  });

  it('returns failed when generate throws', async () => {
    const result = await routeOpsQuery('deploy', ctx, catalog, {
      kind: 'apple-foundation',
      generateStructured: async () => {
        throw new Error('inference failed');
      },
    });
    expect(result).toEqual({ ok: false, error: 'failed' });
  });

  it('rejects junk objects', () => {
    expect(
      sanitizeOpsRoute({ headline: 'nope' }, catalogIds, 'apple-foundation'),
    ).toEqual({ ok: false, error: 'rejected' });
    expect(sanitizeOpsRoute(null, catalogIds, 'gemini-nano')).toEqual({
      ok: false,
      error: 'rejected',
    });
  });

  it('rejects actions outside the catalog including mutators', () => {
    expect(
      sanitizeOpsRoute(
        {
          action: 'redeploy',
          reason: 'ship it',
          answer: '',
          nextSteps: [],
        },
        catalogIds,
        'apple-foundation',
      ),
    ).toEqual({ ok: false, error: 'rejected' });
  });

  it('rejects secret-like answer text', () => {
    expect(
      sanitizeOpsRoute(
        {
          action: OPS_ROUTE_ANSWER,
          reason: 'token',
          answer: 'use vcp_leakedtoken',
          nextSteps: [],
        },
        catalogIds,
        'apple-foundation',
      ),
    ).toEqual({ ok: false, error: 'rejected' });
  });

  it('requires answer text when action is answer', () => {
    expect(
      sanitizeOpsRoute(
        { action: OPS_ROUTE_ANSWER, reason: 'ok', answer: '', nextSteps: [] },
        catalogIds,
        'gemini-nano',
      ),
    ).toEqual({ ok: false, error: 'rejected' });
  });

  it('routes deploy wording to deploys with a mock backend', async () => {
    const result = await routeOpsQuery(
      'deploy',
      ctx,
      catalog,
      backendReturning({
        action: 'deploys',
        reason: 'Open the deployments list',
        answer: '',
        nextSteps: ['Pick a deployment'],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action).toBe('deploys');
    expect(result.reason).toMatch(/deploy/i);
    expect(result.source).toBe('apple-foundation');
    expect(result.nextSteps).toEqual(['Pick a deployment']);
  });

  it('accepts a Gemini Nano answer from context', async () => {
    const result = await routeOpsQuery(
      'is production up',
      ctx,
      catalog,
      backendReturning(
        {
          action: OPS_ROUTE_ANSWER,
          reason: 'Production is READY',
          answer: 'shop production is READY.',
          nextSteps: [],
        },
        'gemini-nano',
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action).toBe(OPS_ROUTE_ANSWER);
    expect(result.source).toBe('gemini-nano');
    expect(result.answer).toMatch(/READY/);
  });
});
