import { describe, expect, it } from 'vitest';
import { explainFirewall } from '../src/domain/analysis/firewallExplain';

describe('explainFirewall', () => {
  it('explains elevated denials', () => {
    const e = explainFirewall({
      availability: 'ok',
      current: {
        allowed: 100,
        denied: 90,
        challenged: 10,
        topDeniedRoute: '/api/login',
      },
      previous: { allowed: 120, denied: 20, challenged: 5 },
    });
    expect(e.headline).toMatch(/elevated/i);
    expect(e.changeFromPrevious).toBeTruthy();
    expect(e.mutationsAllowed).toBe(false);
    expect(e.suggestedAction).toMatch(/aggressive|false positive/i);
  });

  it('does not invent counts when unavailable', () => {
    const e = explainFirewall({
      availability: 'not_enabled',
      current: null,
      previous: null,
    });
    expect(e.bullets.join(' ')).not.toMatch(/Allowed: \d/);
    expect(e.headline).toMatch(/Not enabled|Firewall/i);
  });
});
