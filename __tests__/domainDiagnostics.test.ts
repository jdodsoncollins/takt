import { describe, expect, it } from 'vitest';
import {
  buildDomainDiagnosticsReport,
  diagnoseDomain,
} from '../src/domain/analysis/domainDiagnostics';

describe('domainDiagnostics', () => {
  it('flags pending verification as critical', () => {
    const d = diagnoseDomain(
      { name: 'example.com', verified: false },
      { misconfigured: true, recommendedCNAME: ['cname.vercel-dns.com'] },
    );
    expect(d.severity).toBe('critical');
    expect(d.verification).toBe('pending');
    expect(d.dns).toBe('misconfigured');
    expect(d.suggestedAction).toBeTruthy();
  });

  it('marks verified + configured as ok', () => {
    const d = diagnoseDomain(
      { name: 'app.example.com', verified: true },
      { misconfigured: false },
    );
    expect(d.severity).toBe('ok');
    expect(d.ssl).toBe('valid');
  });

  it('reports empty domain list clearly', () => {
    const r = buildDomainDiagnosticsReport('prj_1', [], new Map());
    expect(r.summary).toMatch(/No custom domains/i);
  });

  it('preserves unavailable availability', () => {
    const r = buildDomainDiagnosticsReport('prj_1', [], new Map(), {
      availability: 'unavailable_for_plan',
      note: 'scope',
    });
    expect(r.availability).toBe('unavailable_for_plan');
    expect(r.domains).toHaveLength(0);
  });
});
