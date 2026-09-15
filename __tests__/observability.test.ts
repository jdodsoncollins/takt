import { describe, expect, it } from 'vitest';
import { buildObservabilitySnapshot } from '../src/domain/analysis/observability';
import { formatMetricSlot } from '../src/domain/analysis/dataAvailability';

describe('observability snapshot', () => {
  it('does not invent metrics when not enabled', () => {
    const s = buildObservabilitySnapshot({
      kind: 'not_enabled',
      detail: 'Enable Web Analytics',
    });
    expect(s.pageviews.availability).toBe('not_enabled');
    expect(s.pageviews.value).toBeNull();
    expect(formatMetricSlot('Pageviews', s.pageviews)).toMatch(/Not enabled/i);
    expect(formatMetricSlot('Pageviews', s.pageviews)).not.toMatch(/^Pageviews: —$/);
  });

  it('maps ok payload fields', () => {
    const s = buildObservabilitySnapshot({
      kind: 'ok',
      pageviews: 1200,
      visitors: 400,
      errorRatePct: 1.25,
    });
    expect(s.pageviews.value).toBe(1200);
    expect(s.visitors.availability).toBe('ok');
    expect(s.errorRate.value).toContain('1.25');
    expect(s.coldStarts.availability).toBe('no_data');
  });

  it('uses unavailable_for_plan honestly', () => {
    const s = buildObservabilitySnapshot({
      kind: 'unavailable_for_plan',
    });
    expect(s.headline).toMatch(/plan|entitlement|Unavailable/i);
  });
});
