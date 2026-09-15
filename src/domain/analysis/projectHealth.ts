import type {
  AttentionReason,
  DeploymentState,
  VercelDeploymentSummary,
  VercelProject,
} from '../models/vercelModels';

export type HealthLevel = 'healthy' | 'degraded' | 'critical' | 'unknown';

export interface ProjectHealthCard {
  level: HealthLevel;
  score: number;
  headline: string;
  bullets: string[];
  suggestedNextStep: string | null;
  attentionReason: AttentionReason;
}

export function mapDeploymentState(raw: string | null | undefined): DeploymentState {
  const s = (raw ?? '').toUpperCase();
  switch (s) {
    case 'BLOCKED':
    case 'BUILDING':
    case 'ERROR':
    case 'INITIALIZING':
    case 'QUEUED':
    case 'READY':
    case 'CANCELED':
    case 'DELETED':
      return s;
    default:
      return 'UNKNOWN';
  }
}

export function isFailedState(state: DeploymentState): boolean {
  return state === 'BLOCKED' || state === 'ERROR' || state === 'CANCELED';
}

export function isSuccessState(state: DeploymentState): boolean {
  return state === 'READY';
}

export function isInFlightState(state: DeploymentState): boolean {
  return (
    state === 'BUILDING' ||
    state === 'INITIALIZING' ||
    state === 'QUEUED'
  );
}

/** Derive attention flags from production / latest / failed deployments. */
export function computeAttention(input: {
  production: VercelDeploymentSummary | null;
  latest: VercelDeploymentSummary | null;
  lastSuccess: VercelDeploymentSummary | null;
  latestFailed: VercelDeploymentSummary | null;
}): { needsAttention: boolean; attentionReason: AttentionReason } {
  const prod = input.production;
  if (prod && isFailedState(prod.state)) {
    return { needsAttention: true, attentionReason: 'latest_production_failed' };
  }
  if (prod && isInFlightState(prod.state)) {
    return { needsAttention: true, attentionReason: 'building' };
  }
  if (!prod && input.latestFailed) {
    return { needsAttention: true, attentionReason: 'latest_production_failed' };
  }
  if (!prod) {
    return { needsAttention: true, attentionReason: 'no_production' };
  }
  if (isSuccessState(prod.state) && input.latestFailed) {
    const failed = input.latestFailed;
    const failedAfterProd = failed.createdAt > prod.createdAt;
    const otherFailedProduction =
      failed.target === 'production' && failed.id !== prod.id;
    if (failedAfterProd || otherFailedProduction) {
      return { needsAttention: true, attentionReason: 'recent_failure' };
    }
  }
  return { needsAttention: false, attentionReason: 'none' };
}

export function buildProjectHealthCard(project: VercelProject): ProjectHealthCard {
  const { attentionReason, needsAttention } = {
    attentionReason: project.attentionReason,
    needsAttention: project.needsAttention,
  };

  const bullets: string[] = [];
  let level: HealthLevel = 'healthy';
  let score = 90;
  let headline = 'Production health: Healthy';
  let suggestedNextStep: string | null = null;

  const prod = project.productionDeployment;
  if (prod) {
    bullets.push(
      `Latest production: ${prod.state}${
        prod.meta.githubCommitRef ? ` · ${prod.meta.githubCommitRef}` : ''
      }`,
    );
  } else {
    bullets.push('No production deployment found');
  }

  if (project.lastSuccessfulDeployment) {
    bullets.push(
      `Last successful: ${shortSha(project.lastSuccessfulDeployment)} · ${formatAgo(
        project.lastSuccessfulDeployment.createdAt,
      )}`,
    );
  }

  if (project.latestFailedDeployment) {
    bullets.push(
      `Latest failed: ${shortSha(project.latestFailedDeployment)} · ${
        project.latestFailedDeployment.meta.githubCommitMessage?.slice(0, 80) ??
        project.latestFailedDeployment.state
      }`,
    );
  }

  if (attentionReason === 'latest_production_failed') {
    level = 'critical';
    score = 25;
    headline = 'Production health: Critical';
    suggestedNextStep =
      'Open the failed deployment, review build logs, then compare with last successful.';
  } else if (attentionReason === 'building') {
    level = 'degraded';
    score = 55;
    headline = 'Production health: Deploying';
    suggestedNextStep = 'Wait for the build to finish, then refresh.';
  } else if (attentionReason === 'no_production') {
    level = 'unknown';
    score = 40;
    headline = 'Production health: Unknown';
    suggestedNextStep = 'Confirm a production deployment exists for this project.';
  } else if (attentionReason === 'recent_failure') {
    level = 'degraded';
    score = 62;
    headline = 'Production is READY · recent failure in history';
    suggestedNextStep =
      'Open the failed deployment, run Diagnose, then decide whether a rollback is needed.';
  } else if (needsAttention) {
    level = 'degraded';
    score = 60;
    headline = 'Production health: Degraded';
  }

  if (project.framework) {
    bullets.push(`Framework: ${project.framework}`);
  }
  if (project.primaryDomain) {
    bullets.push(`Primary domain: ${project.primaryDomain}`);
  }

  return {
    level,
    score,
    headline,
    bullets,
    suggestedNextStep,
    attentionReason,
  };
}

function shortSha(d: VercelDeploymentSummary): string {
  const sha = d.meta.githubCommitSha;
  if (sha && sha.length >= 7) return sha.slice(0, 7);
  return d.id.slice(0, 8);
}

function formatAgo(ms: number): string {
  const delta = Date.now() - ms;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

/** Pick production / success / failed from a deployment list. */
export function summarizeDeployments(
  deployments: VercelDeploymentSummary[],
): {
  production: VercelDeploymentSummary | null;
  latest: VercelDeploymentSummary | null;
  lastSuccess: VercelDeploymentSummary | null;
  latestFailed: VercelDeploymentSummary | null;
} {
  const sorted = [...deployments].sort((a, b) => b.createdAt - a.createdAt);
  const latest = sorted[0] ?? null;
  const production =
    sorted.find((d) => d.target === 'production') ?? null;
  const lastSuccess =
    sorted.find((d) => isSuccessState(d.state) && d.target === 'production') ??
    sorted.find((d) => isSuccessState(d.state)) ??
    null;
  const latestFailed = sorted.find((d) => isFailedState(d.state)) ?? null;
  return { production, latest, lastSuccess, latestFailed };
}
