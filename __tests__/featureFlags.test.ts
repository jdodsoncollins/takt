import { describe, expect, it } from 'vitest';
import { buildFeatureFlagsReport } from '../src/domain/analysis/featureFlags';

describe('featureFlags', () => {
  it('summarizes active flags', () => {
    const r = buildFeatureFlagsReport({
      availability: 'ok',
      flags: [
        {
          id: '1',
          slug: 'checkout-v2',
          name: 'Checkout V2',
          state: 'active',
          environment: 'production',
        },
        {
          id: '2',
          slug: 'old',
          name: 'Old',
          state: 'paused',
        },
      ],
    });
    expect(r.summary).toMatch(/2 flag/);
    expect(r.mutationsAllowed).toBe(false);
  });

  it('handles unavailable honestly', () => {
    const r = buildFeatureFlagsReport({
      availability: 'unavailable_for_plan',
      flags: null,
      note: 'no flags product',
    });
    expect(r.flags).toHaveLength(0);
    expect(r.summary).toMatch(/Unavailable/i);
  });
});
