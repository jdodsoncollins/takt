import type { DataAvailability } from '../models/vercelModels';

export type DomainVerification = 'verified' | 'pending' | 'unknown';
export type DnsStatus = 'configured' | 'misconfigured' | 'unknown' | 'not_checked';
export type SslStatus = 'valid' | 'pending' | 'error' | 'unknown';

export interface ProjectDomainMeta {
  name: string;
  verified: boolean | null;
  /** apex / redirect / git branch etc when known */
  redirect?: string | null;
  gitBranch?: string | null;
  /** Production or preview assignment when known */
  environment?: string | null;
}

export interface DomainConfigMeta {
  /** Whether nameservers / recommended config looks correct */
  misconfigured: boolean | null;
  acceptedChallenges?: string[] | null;
  recommendedIPv4?: string[] | null;
  recommendedCNAME?: string[] | null;
  configuredBy?: string | null;
}

export interface DomainDiagnosis {
  name: string;
  verification: DomainVerification;
  dns: DnsStatus;
  ssl: SslStatus;
  environment: string | null;
  findings: string[];
  severity: 'ok' | 'warning' | 'critical';
  suggestedAction: string | null;
}

export interface DomainDiagnosticsReport {
  projectId: string;
  domains: DomainDiagnosis[];
  summary: string;
  availability: DataAvailability;
  note?: string;
}

export function diagnoseDomain(
  domain: ProjectDomainMeta,
  config?: DomainConfigMeta | null,
): DomainDiagnosis {
  const findings: string[] = [];
  let verification: DomainVerification = 'unknown';
  if (domain.verified === true) verification = 'verified';
  else if (domain.verified === false) verification = 'pending';

  let dns: DnsStatus = 'not_checked';
  if (config) {
    if (config.misconfigured === true) {
      dns = 'misconfigured';
      findings.push('DNS configuration appears misconfigured for Vercel');
      if (config.recommendedCNAME?.length) {
        findings.push(
          `Recommended CNAME targets: ${config.recommendedCNAME.slice(0, 3).join(', ')}`,
        );
      }
      if (config.recommendedIPv4?.length) {
        findings.push(
          `Recommended A records: ${config.recommendedIPv4.slice(0, 3).join(', ')}`,
        );
      }
    } else if (config.misconfigured === false) {
      dns = 'configured';
    } else {
      dns = 'unknown';
    }
  }

  // SSL is not always exposed distinctly; infer conservatively
  let ssl: SslStatus = 'unknown';
  if (verification === 'verified' && dns === 'configured') {
    ssl = 'valid';
  } else if (verification === 'pending' || dns === 'misconfigured') {
    ssl = 'pending';
    findings.push(
      'SSL may not complete until domain verification and DNS are correct',
    );
  }

  if (verification === 'pending') {
    findings.push('Domain is not verified for this project');
  }
  if (domain.redirect) {
    findings.push(`Redirects to ${domain.redirect}`);
  }
  if (domain.gitBranch) {
    findings.push(`Git branch assignment: ${domain.gitBranch}`);
  }

  let severity: DomainDiagnosis['severity'] = 'ok';
  let suggestedAction: string | null = null;
  if (verification === 'pending' || dns === 'misconfigured') {
    severity = 'critical';
    suggestedAction =
      'Fix DNS / complete verification in Vercel Domains, then re-check. Domain mutations are not available from Taktung yet.';
  } else if (ssl === 'pending' || verification === 'unknown') {
    severity = 'warning';
    suggestedAction = 'Re-check domain configuration after DNS propagates.';
  }

  if (findings.length === 0) {
    findings.push('No domain issues detected from available signals');
  }

  return {
    name: domain.name,
    verification,
    dns,
    ssl,
    environment: domain.environment ?? null,
    findings,
    severity,
    suggestedAction,
  };
}

export function buildDomainDiagnosticsReport(
  projectId: string,
  domains: ProjectDomainMeta[],
  configs: Map<string, DomainConfigMeta | null>,
  opts?: { availability?: DataAvailability; note?: string },
): DomainDiagnosticsReport {
  const availability = opts?.availability ?? 'ok';
  if (availability !== 'ok') {
    return {
      projectId,
      domains: [],
      summary: opts?.note ?? 'Domain data unavailable',
      availability,
      note: opts?.note,
    };
  }

  const diagnoses = domains.map((d) =>
    diagnoseDomain(d, configs.get(d.name) ?? null),
  );
  const critical = diagnoses.filter((d) => d.severity === 'critical').length;
  const warning = diagnoses.filter((d) => d.severity === 'warning').length;
  const summary =
    domains.length === 0
      ? 'No custom domains on this project'
      : `${domains.length} domain(s): ${critical} critical, ${warning} warning`;

  return {
    projectId,
    domains: diagnoses,
    summary,
    availability: 'ok',
  };
}
