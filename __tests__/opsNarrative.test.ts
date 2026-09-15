import { describe, expect, it } from 'vitest';
import {
  buildBoundedOpsContext,
  formatOpsNarrative,
  synthesizeOpsNarrative,
} from '../src/domain/analysis/opsNarrative';

describe('opsNarrative', () => {
  it('reports stable when no issues', () => {
    const n = synthesizeOpsNarrative(
      buildBoundedOpsContext({
        projectName: 'shop',
        productionState: 'READY',
      }),
    );
    expect(n.headline).toMatch(/stable/i);
    expect(n.nextSteps.length).toBeGreaterThan(0);
  });

  it('prioritizes incident and env drift', () => {
    const n = synthesizeOpsNarrative(
      buildBoundedOpsContext({
        projectName: 'shop',
        needsAttention: true,
        attentionReason: 'latest_production_failed',
        productionState: 'ERROR',
        incidentHeadline: 'Deploy failed',
        incidentCause: 'missing STRIPE_SECRET_KEY',
        incidentConfidence: 'high',
        envDriftCritical: 2,
        envDriftSummary: '2 critical',
      }),
    );
    expect(n.body).toMatch(/STRIPE|drift|attention/i);
    expect(n.confidence).toBe('high');
    expect(formatOpsNarrative(n)).toMatch(/Next steps/);
  });

  it('never requires secret fields in context', () => {
    const ctx = buildBoundedOpsContext({});
    expect(Object.keys(ctx).join(',')).not.toMatch(/secret|password|value/i);
  });

  it('handles polling state', () => {
    const n = synthesizeOpsNarrative(
      buildBoundedOpsContext({ projectName: 'x', polling: true }),
    );
    expect(n.headline).toMatch(/Waiting/i);
    expect(n.body).toMatch(/READY/);
  });
});
