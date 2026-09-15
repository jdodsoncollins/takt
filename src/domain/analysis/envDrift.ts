import type { EnvVarMeta } from '../models/vercelModels';

export type EnvDriftKind =
  | 'missing_in_production'
  | 'missing_in_preview'
  | 'target_mismatch'
  | 'stale_name_hint';

export interface EnvDriftFinding {
  kind: EnvDriftKind;
  key: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface EnvDriftReport {
  findings: EnvDriftFinding[];
  /** Keys present — never values. */
  productionKeys: string[];
  previewKeys: string[];
  developmentKeys: string[];
  summary: string;
}

function targetsOf(vars: EnvVarMeta[], target: string): Set<string> {
  const set = new Set<string>();
  for (const v of vars) {
    if (v.target.some((t) => t.toLowerCase() === target.toLowerCase())) {
      set.add(v.key);
    }
  }
  return set;
}

/**
 * Compare env var *names* across targets.
 * Never include or request secret values.
 */
export function analyzeEnvDrift(vars: EnvVarMeta[]): EnvDriftReport {
  const productionKeys = [...targetsOf(vars, 'production')].sort();
  const previewKeys = [...targetsOf(vars, 'preview')].sort();
  const developmentKeys = [...targetsOf(vars, 'development')].sort();

  const findings: EnvDriftFinding[] = [];
  const prod = new Set(productionKeys);
  const prev = new Set(previewKeys);

  for (const key of previewKeys) {
    if (!prod.has(key)) {
      findings.push({
        kind: 'missing_in_production',
        key,
        detail: `Present in Preview but missing in Production: ${key}`,
        severity: 'critical',
      });
    }
  }

  for (const key of productionKeys) {
    if (!prev.has(key) && previewKeys.length > 0) {
      findings.push({
        kind: 'missing_in_preview',
        key,
        detail: `Present in Production but missing in Preview: ${key}`,
        severity: 'warning',
      });
    }
  }

  // Heuristic: KEY vs KEY_OLD / KEY_V2 style drift
  const allKeys = new Set(vars.map((v) => v.key));
  for (const key of allKeys) {
    if (key.endsWith('_OLD') || key.endsWith('_LEGACY')) {
      const base = key.replace(/_OLD$|_LEGACY$/, '');
      if (allKeys.has(base)) {
        findings.push({
          kind: 'stale_name_hint',
          key,
          detail: `Possible stale variable name: ${key} coexists with ${base}`,
          severity: 'info',
        });
      }
    }
  }

  // Same key with disjoint targets only (already covered) — multi-entry type mismatch
  const byKey = new Map<string, EnvVarMeta[]>();
  for (const v of vars) {
    const list = byKey.get(v.key) ?? [];
    list.push(v);
    byKey.set(v.key, list);
  }
  for (const [key, entries] of byKey) {
    if (entries.length > 1) {
      const types = new Set(entries.map((e) => e.type));
      if (types.size > 1) {
        findings.push({
          kind: 'target_mismatch',
          key,
          detail: `Variable ${key} has mixed types: ${[...types].join(', ')}`,
          severity: 'info',
        });
      }
    }
  }

  const critical = findings.filter((f) => f.severity === 'critical').length;
  const warning = findings.filter((f) => f.severity === 'warning').length;
  let summary: string;
  if (findings.length === 0) {
    summary = `No env drift detected across ${productionKeys.length} production and ${previewKeys.length} preview keys.`;
  } else {
    summary = `${findings.length} finding(s): ${critical} critical, ${warning} warning. Values are never shown.`;
  }

  return {
    findings,
    productionKeys,
    previewKeys,
    developmentKeys,
    summary,
  };
}
