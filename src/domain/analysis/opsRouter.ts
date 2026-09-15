import type { BoundedOpsContext } from './opsNarrative';
import {
  containsSecretLike,
  type OpsSynthesizerKind,
} from './opsSynthesizer';

export type OpsRouteCatalogItem = {
  id: string;
  label: string;
  description: string;
};

export type OpsRouteError = 'unavailable' | 'rejected' | 'failed';

export type OpsRouteOk = {
  ok: true;
  action: string;
  reason: string;
  answer: string;
  nextSteps: string[];
  source: Exclude<OpsSynthesizerKind, 'heuristic' | 'hybrid'>;
};

export type OpsRouteResult = OpsRouteOk | { ok: false; error: OpsRouteError };

export type OpsRouterBackend = {
  kind: Exclude<OpsSynthesizerKind, 'heuristic' | 'hybrid'>;
  generateStructured: (
    prompt: string,
    schema: unknown,
    systemPrompt: string,
  ) => Promise<unknown | null>;
};

export const OPS_ROUTE_ANSWER = 'answer';

const MAX_QUERY_CHARS = 500;

export const OPS_ROUTE_SYSTEM_PROMPT =
  'You route Vercel ops questions to allow-listed Taktung actions. Results render in Search as a summary plus widgets. JSON only. Never output tokens, env values, or invented IDs. You cannot redeploy, promote, or rollback.';

export function buildOpsRouteJsonSchema(catalogIds: string[]) {
  const ids = [
    ...new Set(catalogIds.filter((id) => id.length > 0 && id !== 'unknown')),
  ];
  return {
    type: 'object',
    additionalProperties: false,
    required: ['action', 'reason', 'answer', 'nextSteps'],
    properties: {
      action: { enum: [...ids, OPS_ROUTE_ANSWER] },
      reason: { type: 'string' },
      answer: { type: 'string' },
      nextSteps: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 4,
      },
    },
  };
}

export function buildOpsRoutePrompt(
  query: string,
  ctx: BoundedOpsContext,
  catalog: OpsRouteCatalogItem[],
): string {
  const q = query.trim().slice(0, MAX_QUERY_CHARS);
  return [
    'You are Taktung, a local Vercel operations assistant running on-device.',
    'Pick exactly one action from the catalog, or action "answer" if you can reply from this context without another check.',
    'Search shows a summary plus widgets in place. Never tell the user to open Home, Deployments, Activity, or Settings.',
    'Map deploy, release, and ship wording to deploys. Map health, issues, and brief to issues.',
    'If the user asks to redeploy, promote, or rollback, pick deploys and say a confirmed action is required — do not claim a mutation ran.',
    'Do not invent deployment IDs. If none is selected, pick deploys, issues, or answer.',
    'Never include tokens or env values.',
    `Query: ${q}`,
    `Catalog: ${JSON.stringify(
      catalog.map((item) => ({
        id: item.id,
        label: item.label,
        description: item.description,
      })),
    )}`,
    `Context: ${JSON.stringify(ctx)}`,
  ].join('\n');
}

export function sanitizeOpsRoute(
  raw: unknown,
  catalogIds: ReadonlySet<string>,
  source: Exclude<OpsSynthesizerKind, 'heuristic' | 'hybrid'>,
): OpsRouteResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'rejected' };
  const rec = raw as Record<string, unknown>;
  const action = typeof rec.action === 'string' ? rec.action.trim() : '';
  const allowed = action === OPS_ROUTE_ANSWER || catalogIds.has(action);
  if (!action || !allowed || action === 'unknown') {
    return { ok: false, error: 'rejected' };
  }
  const reason = typeof rec.reason === 'string' ? rec.reason.trim() : '';
  const answer = typeof rec.answer === 'string' ? rec.answer.trim() : '';
  if (containsSecretLike(reason) || containsSecretLike(answer)) {
    return { ok: false, error: 'rejected' };
  }
  const nextSteps: string[] = [];
  if (Array.isArray(rec.nextSteps)) {
    for (const step of rec.nextSteps) {
      if (typeof step !== 'string') continue;
      const trimmed = step.trim();
      if (!trimmed || containsSecretLike(trimmed)) continue;
      nextSteps.push(trimmed);
      if (nextSteps.length === 4) break;
    }
  }
  if (action === OPS_ROUTE_ANSWER && !answer) {
    return { ok: false, error: 'rejected' };
  }
  return {
    ok: true,
    action,
    reason: reason.slice(0, 240),
    answer: answer.slice(0, 800),
    nextSteps,
    source,
  };
}

export async function routeOpsQuery(
  query: string,
  ctx: BoundedOpsContext,
  catalog: OpsRouteCatalogItem[],
  backend: OpsRouterBackend | null,
): Promise<OpsRouteResult> {
  const q = query.trim().slice(0, MAX_QUERY_CHARS);
  if (!q || !backend) return { ok: false, error: 'unavailable' };
  const ids: string[] = [];
  for (const item of catalog) {
    if (item.id !== 'unknown') ids.push(item.id);
  }
  const prompt = buildOpsRoutePrompt(q, ctx, catalog);
  if (containsSecretLike(prompt)) return { ok: false, error: 'rejected' };
  let generated: unknown = null;
  try {
    generated = await backend.generateStructured(
      prompt,
      buildOpsRouteJsonSchema(ids),
      OPS_ROUTE_SYSTEM_PROMPT,
    );
  } catch {
    return { ok: false, error: 'failed' };
  }
  return sanitizeOpsRoute(generated, new Set(ids), backend.kind);
}
