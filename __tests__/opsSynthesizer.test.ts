import { describe, expect, it } from 'vitest';
import { buildBoundedOpsContext } from '../src/domain/analysis/opsNarrative';
import {
  buildOnDeviceOpsPrompt,
  sanitizeOpsNarrative,
  synthesizeOpsNarrativeHybrid,
  synthesizeOpsNarrativeResolved,
} from '../src/domain/analysis/opsSynthesizer';

describe('opsSynthesizer', () => {
  it('defaults to heuristic without a backend', async () => {
    const n = synthesizeOpsNarrativeResolved(
      buildBoundedOpsContext({ projectName: 'shop', productionState: 'READY' }),
    );
    expect(n.source).toBe('heuristic');
    expect(n.headline).toMatch(/stable/i);

    const hybrid = await synthesizeOpsNarrativeHybrid(
      buildBoundedOpsContext({ projectName: 'shop', productionState: 'READY' }),
      null,
    );
    expect(hybrid.source).toBe('heuristic');
  });

  it('builds a prompt from bounded context only', () => {
    const prompt = buildOnDeviceOpsPrompt(
      buildBoundedOpsContext({ projectName: 'shop', productionState: 'READY' }),
    );
    expect(prompt).toMatch(/shop/);
    expect(prompt).not.toMatch(/vcp_|vercel_/);
  });

  it('rejects secret-like on-device output', () => {
    expect(
      sanitizeOpsNarrative(
        {
          headline: 'ok',
          body: 'token vcp_abc leaked',
          nextSteps: ['none'],
          confidence: 'high',
        },
        'apple-foundation',
        ['projectName'],
      ),
    ).toBeNull();
  });

  it('accepts a valid on-device brief', () => {
    const n = sanitizeOpsNarrative(
      {
        headline: 'Shop is healthy',
        body: 'Production is READY.',
        nextSteps: ['Watch runtime 5xx'],
        confidence: 'medium',
        extraSecret: 'nope',
      },
      'gemini-nano',
      ['projectName'],
    );
    expect(n?.source).toBe('gemini-nano');
    expect(n?.headline).toBe('Shop is healthy');
    expect(JSON.stringify(n)).not.toMatch(/extraSecret/);
  });

  it('uses on-device output when the backend succeeds', async () => {
    const n = await synthesizeOpsNarrativeHybrid(
      buildBoundedOpsContext({ projectName: 'shop', productionState: 'READY' }),
      {
        kind: 'apple-foundation',
        generate: async () => ({
          headline: 'On-device brief',
          body: 'Neural Engine wrote this from bounded context.',
          nextSteps: ['Refresh if stale'],
          confidence: 'high',
        }),
      },
    );
    expect(n.source).toBe('apple-foundation');
    expect(n.headline).toBe('On-device brief');
  });

  it('falls back to heuristic when the backend throws', async () => {
    const n = await synthesizeOpsNarrativeHybrid(
      buildBoundedOpsContext({ projectName: 'shop', productionState: 'READY' }),
      {
        kind: 'apple-foundation',
        generate: async () => {
          throw new Error('model unavailable');
        },
      },
    );
    expect(n.source).toBe('heuristic');
  });

  it('marks hybrid when on-device confidence is low', async () => {
    const n = await synthesizeOpsNarrativeHybrid(
      buildBoundedOpsContext({
        projectName: 'shop',
        needsAttention: true,
        attentionReason: 'latest_production_failed',
        productionState: 'ERROR',
        incidentHeadline: 'Build failed',
        incidentCause: 'missing module',
        incidentConfidence: 'high',
      }),
      {
        kind: 'gemini-nano',
        generate: async () => ({
          headline: 'Unsure',
          body: 'Need more signal.',
          nextSteps: [],
          confidence: 'low',
        }),
      },
    );
    expect(n.source).toBe('hybrid');
    expect(n.body).toMatch(/Need more signal/);
  });

  it('skips the model while a deploy poll is active', async () => {
    let called = 0;
    const n = await synthesizeOpsNarrativeHybrid(
      buildBoundedOpsContext({ projectName: 'shop', polling: true }),
      {
        kind: 'apple-foundation',
        generate: async () => {
          called += 1;
          return { headline: 'x', body: 'y', nextSteps: [], confidence: 'high' };
        },
      },
    );
    expect(called).toBe(0);
    expect(n.source).toBe('heuristic');
    expect(n.headline).toMatch(/Waiting on deploy/i);
  });
});
