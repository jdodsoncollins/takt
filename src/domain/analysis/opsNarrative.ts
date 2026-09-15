/**
 * Bounded local ops brief — deterministic "planner" narrative.
 * Only consumes allow-listed structured fields (no secrets, no free API code).
 * Future: swap synthesizer for on-device LLM with same BoundedOpsContext.
 */

export interface BoundedOpsContext {
  projectName: string | null;
  productionState: string | null;
  needsAttention: boolean;
  attentionReason: string | null;
  incidentHeadline: string | null;
  incidentCause: string | null;
  incidentConfidence: string | null;
  envDriftCritical: number;
  envDriftSummary: string | null;
  compareRisk: string | null;
  compareSummary: string | null;
  runtimeErrorCount: number | null;
  runtimeSummary: string | null;
  domainCritical: number;
  domainSummary: string | null;
  polling: boolean;
  lastMutatorNote: string | null;
}

export interface OpsNarrative {
  headline: string;
  body: string;
  nextSteps: string[];
  confidence: 'low' | 'medium' | 'high';
  /** JSON-safe context echo for audit (no secrets). */
  usedFields: string[];
  /** How the brief was produced. Never a cloud LLM by default. */
  source?: 'heuristic' | 'apple-foundation' | 'gemini-nano' | 'hybrid';
}

export function buildBoundedOpsContext(
  partial: Partial<BoundedOpsContext>,
): BoundedOpsContext {
  return {
    projectName: partial.projectName ?? null,
    productionState: partial.productionState ?? null,
    needsAttention: partial.needsAttention ?? false,
    attentionReason: partial.attentionReason ?? null,
    incidentHeadline: partial.incidentHeadline ?? null,
    incidentCause: partial.incidentCause ?? null,
    incidentConfidence: partial.incidentConfidence ?? null,
    envDriftCritical: partial.envDriftCritical ?? 0,
    envDriftSummary: partial.envDriftSummary ?? null,
    compareRisk: partial.compareRisk ?? null,
    compareSummary: partial.compareSummary ?? null,
    runtimeErrorCount: partial.runtimeErrorCount ?? null,
    runtimeSummary: partial.runtimeSummary ?? null,
    domainCritical: partial.domainCritical ?? 0,
    domainSummary: partial.domainSummary ?? null,
    polling: partial.polling ?? false,
    lastMutatorNote: partial.lastMutatorNote ?? null,
  };
}

/** Synthesize a short ops brief from bounded context only. */
export function synthesizeOpsNarrative(ctx: BoundedOpsContext): OpsNarrative {
  const used: string[] = [];
  const next: string[] = [];
  let confidence: OpsNarrative['confidence'] = 'low';
  const name = ctx.projectName ?? 'this project';
  used.push('projectName');

  if (ctx.polling) {
    used.push('polling');
    return {
      headline: `Waiting on deploy for ${name}`,
      body: 'A mutator was accepted and Taktung is polling Vercel. Success is only recorded when state is READY.',
      nextSteps: [
        'Wait for the poll result in Activity',
        'If timeout, refresh deployments and re-check state',
      ],
      confidence: 'high',
      usedFields: used,
    };
  }

  const issues: string[] = [];

  if (ctx.needsAttention) {
    used.push('needsAttention', 'attentionReason', 'productionState');
    issues.push(
      `Needs attention (${ctx.attentionReason ?? 'unknown'}). Production state: ${
        ctx.productionState ?? 'unknown'
      }.`,
    );
    confidence = 'medium';
  }

  if (ctx.incidentCause || ctx.incidentHeadline) {
    used.push('incidentHeadline', 'incidentCause', 'incidentConfidence');
    issues.push(
      `Incident: ${ctx.incidentHeadline ?? 'failure'}. Likely cause: ${
        ctx.incidentCause ?? 'unknown'
      } (${ctx.incidentConfidence ?? 'low'} confidence).`,
    );
    if (ctx.incidentConfidence === 'high') confidence = 'high';
    next.push('Open Diagnose evidence and fix the root cause before redeploy');
  }

  if (ctx.envDriftCritical > 0) {
    used.push('envDriftCritical', 'envDriftSummary');
    issues.push(
      `Env drift: ${ctx.envDriftCritical} critical finding(s). ${
        ctx.envDriftSummary ?? ''
      }`.trim(),
    );
    confidence = confidence === 'low' ? 'medium' : confidence;
    next.push('Align missing Production env names (values never shown in Taktung)');
  }

  if (ctx.domainCritical > 0) {
    used.push('domainCritical', 'domainSummary');
    issues.push(
      `Domains: ${ctx.domainCritical} critical. ${ctx.domainSummary ?? ''}`.trim(),
    );
    next.push('Fix DNS / verification in Vercel Domains');
  }

  if (ctx.compareRisk === 'high' || ctx.compareRisk === 'medium') {
    used.push('compareRisk', 'compareSummary');
    issues.push(
      `Deploy delta risk ${ctx.compareRisk}: ${ctx.compareSummary ?? ''}`.trim(),
    );
    next.push('Review commit delta before promote');
  }

  if (ctx.runtimeErrorCount != null && ctx.runtimeErrorCount > 0) {
    used.push('runtimeErrorCount', 'runtimeSummary');
    issues.push(
      `Runtime: ${ctx.runtimeErrorCount} error-like line(s). ${
        ctx.runtimeSummary ?? ''
      }`.trim(),
    );
    confidence = 'medium';
    next.push('Inspect top error paths from Runtime 5xx report');
  }

  if (ctx.lastMutatorNote) {
    used.push('lastMutatorNote');
  }

  if (issues.length === 0) {
    return {
      headline: `${name} looks stable`,
      body: `No critical signals in the loaded snapshot. Production state: ${
        ctx.productionState ?? 'unknown'
      }. Load Domain, Env drift, Runtime, or Diagnose for a deeper brief.`,
      nextSteps: [
        'Refresh projects if data may be stale',
        'Run Runtime 5xx for production error window',
      ],
      confidence: 'medium',
      usedFields: used,
    };
  }

  if (next.length === 0) {
    next.push('Refresh deployments and re-run Diagnose on the failing deploy');
  }

  return {
    headline: `Brief for ${name}`,
    body: issues.join(' '),
    nextSteps: next.slice(0, 4),
    confidence,
    usedFields: used,
  };
}

export function formatOpsNarrative(n: OpsNarrative): string {
  return [
    n.headline,
    '',
    n.body,
    '',
    'Next steps:',
    ...n.nextSteps.map((s, i) => `${i + 1}. ${s}`),
    '',
    `Confidence: ${n.confidence}`,
  ].join('\n');
}
