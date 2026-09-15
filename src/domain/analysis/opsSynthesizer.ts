import type { BoundedOpsContext, OpsNarrative } from './opsNarrative';
import { synthesizeOpsNarrative } from './opsNarrative';

/**
 * On-device synthesizer. iOS 26.4+ Apple Foundation Models or Android ML Kit /
 * Gemini Nano. Heuristic planner is the hybrid fallback — never cloud, never
 * secrets. BoundedOpsContext is the only allowed prompt input.
 */
export type OpsSynthesizerKind =
  | 'heuristic'
  | 'apple-foundation'
  | 'gemini-nano'
  | 'hybrid';

export const OPS_NARRATIVE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'body', 'nextSteps', 'confidence'],
  properties: {
    headline: { type: 'string' },
    body: { type: 'string' },
    nextSteps: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
    confidence: { enum: ['low', 'medium', 'high'] },
  },
} as const;

const SECRETISH = /\b(vcp_|vercel_|sk_live|password\s*[:=]|api[_-]?key\s*[:=])/i;

export function containsSecretLike(text: string): boolean {
  return SECRETISH.test(text);
}

export type OnDeviceBackend = {
  kind: Exclude<OpsSynthesizerKind, 'heuristic' | 'hybrid'>;
  generate: (prompt: string) => Promise<unknown | null>;
  /**
   * Structured generate for Search routing. Briefs keep using `generate`.
   * Optional so heuristic tests can stub `generate` only.
   */
  generateStructured?: (
    prompt: string,
    schema: unknown,
    systemPrompt: string,
  ) => Promise<unknown | null>;
};

export function buildOnDeviceOpsPrompt(ctx: BoundedOpsContext): string {
  return [
    'You are Taktung, a local Vercel operations assistant.',
    'Write a short ops brief from this JSON context only.',
    'Do not invent deployment IDs, metrics, or secret values.',
    'Return JSON with headline, body, nextSteps (max 4 strings), confidence (low|medium|high).',
    JSON.stringify(ctx),
  ].join('\n');
}

export function sanitizeOpsNarrative(
  raw: unknown,
  source: OpsSynthesizerKind,
  usedFields: string[],
): OpsNarrative | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const headline = typeof rec.headline === 'string' ? rec.headline.trim() : '';
  const body = typeof rec.body === 'string' ? rec.body.trim() : '';
  if (!headline || !body) return null;
  if (containsSecretLike(headline) || containsSecretLike(body)) return null;
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
  const confidence =
    rec.confidence === 'high' || rec.confidence === 'medium' || rec.confidence === 'low'
      ? rec.confidence
      : 'low';
  return {
    headline: headline.slice(0, 160),
    body: body.slice(0, 800),
    nextSteps,
    confidence,
    usedFields,
    source,
  };
}

export function synthesizeOpsNarrativeResolved(
  ctx: BoundedOpsContext,
): OpsNarrative {
  return {
    ...synthesizeOpsNarrative(ctx),
    source: 'heuristic',
  };
}

/**
 * On-device first; heuristic if the model is missing, rejects, or leaks.
 * Low-confidence on-device output with a stronger heuristic brief → hybrid.
 */
export async function synthesizeOpsNarrativeHybrid(
  ctx: BoundedOpsContext,
  backend: OnDeviceBackend | null,
): Promise<OpsNarrative> {
  const heuristic = synthesizeOpsNarrativeResolved(ctx);
  if (!backend || ctx.polling) return heuristic;

  let generated: unknown = null;
  try {
    generated = await backend.generate(buildOnDeviceOpsPrompt(ctx));
  } catch {
    return heuristic;
  }
  const onDevice = sanitizeOpsNarrative(
    generated,
    backend.kind,
    heuristic.usedFields,
  );
  if (!onDevice) return heuristic;
  if (onDevice.confidence === 'low' && heuristic.confidence !== 'low') {
    return {
      ...heuristic,
      headline: onDevice.headline || heuristic.headline,
      body: [onDevice.body, heuristic.body].filter(Boolean).join(' '),
      source: 'hybrid',
    };
  }
  if (onDevice.nextSteps.length === 0) {
    return { ...onDevice, nextSteps: heuristic.nextSteps, source: 'hybrid' };
  }
  return onDevice;
}
