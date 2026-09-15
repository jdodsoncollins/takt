import { describe, expect, it } from 'vitest';
import { analyzeEnvDrift } from '../src/domain/analysis/envDrift';
import type { EnvVarMeta } from '../src/domain/models/vercelModels';

function env(
  key: string,
  target: string[],
  type = 'encrypted',
): EnvVarMeta {
  return { id: `id_${key}`, key, type, target };
}

describe('analyzeEnvDrift', () => {
  it('detects preview-only keys missing in production', () => {
    const report = analyzeEnvDrift([
      env('STRIPE_SECRET_KEY', ['preview']),
      env('NEXT_PUBLIC_URL', ['production', 'preview']),
    ]);
    expect(report.findings.some((f) => f.kind === 'missing_in_production')).toBe(
      true,
    );
    expect(report.productionKeys).toEqual(['NEXT_PUBLIC_URL']);
    expect(report.previewKeys).toContain('STRIPE_SECRET_KEY');
  });

  it('never requires values — empty targets still safe', () => {
    const report = analyzeEnvDrift([env('EMPTY', [])]);
    expect(report.productionKeys).toEqual([]);
    expect(report.previewKeys).toEqual([]);
    expect(report.summary).toMatch(/No env drift|finding/i);
  });

  it('flags stale _OLD names when base exists', () => {
    const report = analyzeEnvDrift([
      env('API_URL', ['production']),
      env('API_URL_OLD', ['production']),
    ]);
    expect(report.findings.some((f) => f.kind === 'stale_name_hint')).toBe(
      true,
    );
  });

  it('reports clean when targets align', () => {
    const report = analyzeEnvDrift([
      env('A', ['production', 'preview']),
      env('B', ['production', 'preview']),
    ]);
    expect(report.findings.filter((f) => f.severity === 'critical')).toHaveLength(
      0,
    );
  });
});
