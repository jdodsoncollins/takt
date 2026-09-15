import type { VercelDeploymentSummary } from '../models/vercelModels';
import { isFailedState, isSuccessState } from './projectHealth';
import { firstCommitLine } from './incidentSummary';

export interface DeploymentDiff {
  currentId: string;
  baselineId: string;
  commitChanged: boolean;
  branchChanged: boolean;
  targetChanged: boolean;
  stateChanged: boolean;
  frameworkHint: string | null;
  bullets: string[];
  summary: string;
  /** 0–100: higher = more similar / healthier transition */
  similarityScore: number;
  /** 0–100: higher = riskier change set */
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  suggestedNextStep: string | null;
}

export function compareDeployments(
  current: VercelDeploymentSummary,
  baseline: VercelDeploymentSummary,
): DeploymentDiff {
  const bullets: string[] = [];
  const commitChanged =
    (current.meta.githubCommitSha ?? null) !==
    (baseline.meta.githubCommitSha ?? null);
  const branchChanged =
    (current.meta.githubCommitRef ?? null) !==
    (baseline.meta.githubCommitRef ?? null);
  const targetChanged = current.target !== baseline.target;
  const stateChanged = current.state !== baseline.state;

  if (commitChanged) {
    bullets.push(
      `Commit: ${baseline.meta.githubCommitSha?.slice(0, 7) ?? 'unknown'} → ${
        current.meta.githubCommitSha?.slice(0, 7) ?? 'unknown'
      }`,
    );
    const subject = firstCommitLine(current.meta.githubCommitMessage);
    if (subject) bullets.push(`Subject: ${subject}`);
  } else {
    bullets.push('Commit: unchanged');
  }

  if (branchChanged) {
    bullets.push(
      `Branch: ${baseline.meta.githubCommitRef ?? 'unknown'} → ${
        current.meta.githubCommitRef ?? 'unknown'
      }`,
    );
  }

  if (targetChanged) {
    bullets.push(
      `Target: ${baseline.target ?? 'none'} → ${current.target ?? 'none'}`,
    );
  }

  if (stateChanged) {
    bullets.push(`State: ${baseline.state} → ${current.state}`);
  }

  if (
    current.buildDurationMs != null &&
    baseline.buildDurationMs != null
  ) {
    const delta = current.buildDurationMs - baseline.buildDurationMs;
    bullets.push(
      `Build duration delta: ${delta >= 0 ? '+' : ''}${Math.round(
        delta / 1000,
      )}s`,
    );
  }

  // Scoring
  let riskScore = 0;
  if (commitChanged) riskScore += 25;
  if (branchChanged) riskScore += 20;
  if (targetChanged) riskScore += 15;
  if (isFailedState(current.state)) riskScore += 40;
  if (isSuccessState(baseline.state) && isFailedState(current.state)) {
    riskScore += 10;
  }
  if (
    current.buildDurationMs != null &&
    baseline.buildDurationMs != null &&
    baseline.buildDurationMs > 0
  ) {
    const ratio = current.buildDurationMs / baseline.buildDurationMs;
    if (ratio > 1.5) riskScore += 10;
  }
  riskScore = Math.min(100, riskScore);
  const similarityScore = Math.max(0, 100 - riskScore);
  const riskLevel: DeploymentDiff['riskLevel'] =
    riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low';

  let suggestedNextStep: string | null = null;
  if (isFailedState(current.state)) {
    suggestedNextStep =
      'Run Diagnose on the current deployment and compare env presence with the baseline.';
  } else if (commitChanged && riskLevel !== 'low') {
    suggestedNextStep =
      'Review commit delta and watch error rate after promote.';
  } else if (!commitChanged && !stateChanged) {
    suggestedNextStep = 'No structural change — check runtime logs if symptoms persist.';
  }

  const summaryParts = [
    commitChanged ? 'Commit changed' : 'Commit unchanged',
    branchChanged ? 'branch changed' : null,
    stateChanged ? `state ${baseline.state} → ${current.state}` : null,
  ].filter((part): part is string => part != null);
  const summary =
    summaryParts.length > 0
      ? summaryParts.join(' · ')
      : 'No structural differences detected.';

  return {
    currentId: current.id,
    baselineId: baseline.id,
    commitChanged,
    branchChanged,
    targetChanged,
    stateChanged,
    frameworkHint: null,
    bullets,
    summary,
    similarityScore,
    riskScore,
    riskLevel,
    suggestedNextStep,
  };
}

/** Pick last successful deployment excluding current, for one-tap compare. */
export function pickBaselineDeployment(
  current: VercelDeploymentSummary,
  list: VercelDeploymentSummary[],
): VercelDeploymentSummary | null {
  const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
  return (
    sorted.find(
      (d) =>
        d.id !== current.id &&
        isSuccessState(d.state) &&
        (current.target == null ||
          d.target === current.target ||
          d.target === 'production'),
    ) ??
    sorted.find((d) => d.id !== current.id && isSuccessState(d.state)) ??
    null
  );
}
