import type { VercelDeploymentSummary } from '../models/vercelModels';
import { isFailedState, isSuccessState } from './projectHealth';

export interface IncidentSummary {
  headline: string;
  likelyCause: string | null;
  evidence: string[];
  comparedWith: string | null;
  suggestedAction: string;
  confidence: 'low' | 'medium' | 'high';
  commitSubject: string | null;
  commitSha: string | null;
}

/** First line of a git subject, trimmed. Never mix the body into diagnosis copy. */
export function firstCommitLine(
  message: string | null | undefined,
  max = 88,
): string | null {
  if (!message) return null;
  const line =
    message
      .split(/\r?\n/)
      .map((part) => part.trim())
      .find(Boolean) ?? '';
  if (!line) return null;
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

export interface BuildLogLine {
  text: string;
  type?: string | null;
  created?: number | null;
}

const ENV_HINT =
  /\b(env|environment variable|process\.env|missing|undefined|SECRET|API_KEY|TOKEN)\b/i;
const MODULE_HINT =
  /\b(Cannot find module|Module not found|ERR_MODULE_NOT_FOUND)\b/i;
const TYPE_HINT = /\b(Type error|TS\d{4}|Failed to compile)\b/i;
const OOM_HINT = /\b(JavaScript heap out of memory|ENOMEM|killed)\b/i;

/**
 * Local, deterministic incident summary from deployment + log tails.
 * No LLM required for MVP; honest about confidence.
 */
export function summarizeFailedDeployment(input: {
  failed: VercelDeploymentSummary;
  lastSuccess: VercelDeploymentSummary | null;
  logLines: BuildLogLine[];
  missingProductionEnvKeys?: string[];
}): IncidentSummary {
  const { failed, lastSuccess, logLines, missingProductionEnvKeys = [] } =
    input;
  const evidence: string[] = [];
  const logText = logLines.map((l) => l.text).join('\n');

  const commitSubject = firstCommitLine(failed.meta.githubCommitMessage);
  const commitSha = failed.meta.githubCommitSha?.slice(0, 12) ?? null;

  if (!isFailedState(failed.state)) {
    return {
      headline: `${failed.name} is ${failed.state}`,
      likelyCause: null,
      evidence: [],
      comparedWith: null,
      suggestedAction:
        'This deployment did not fail. Open it from Deployments, or pick a failed row.',
      confidence: 'low',
      commitSubject,
      commitSha,
    };
  }

  evidence.push(
    `Failed deployment ${failed.id} state=${failed.state} target=${
      failed.target ?? 'unknown'
    }`,
  );

  let likelyCause: string | null = null;
  let confidence: IncidentSummary['confidence'] = 'low';
  let suggestedAction =
    'Open full build logs, fix the root error, and redeploy after review.';

  if (missingProductionEnvKeys.length > 0) {
    likelyCause = `Missing production environment variable(s): ${missingProductionEnvKeys
      .slice(0, 5)
      .join(', ')}${missingProductionEnvKeys.length > 5 ? '…' : ''}`;
    confidence = 'high';
    evidence.push(
      `Env presence check (names only): ${missingProductionEnvKeys.length} key(s) in Preview but not Production`,
    );
    suggestedAction =
      'Add the missing variable name(s) to Production in Vercel, then redeploy. Values are never shown in Taktung.';
  } else if (OOM_HINT.test(logText)) {
    likelyCause = 'Build ran out of memory';
    confidence = 'high';
    evidence.push('Log signature: out-of-memory / killed process');
    suggestedAction =
      'Reduce build memory pressure or increase function/build resources, then redeploy.';
  } else if (MODULE_HINT.test(logText)) {
    likelyCause = 'Missing dependency or import path';
    confidence = 'high';
    evidence.push('Log signature: module not found');
    suggestedAction =
      'Fix the import or install the dependency, push, and redeploy.';
  } else if (TYPE_HINT.test(logText)) {
    likelyCause = 'TypeScript / compile error';
    confidence = 'high';
    evidence.push('Log signature: type/compile failure');
    suggestedAction = 'Fix the compile error locally, then redeploy.';
  } else if (ENV_HINT.test(logText)) {
    likelyCause = 'Possible environment variable issue (from log keywords)';
    confidence = 'medium';
    evidence.push('Log keywords suggest env/config problem');
    suggestedAction =
      'Run env drift check (names only) and compare with last successful deployment config.';
  } else if (logLines.length === 0) {
    likelyCause = null;
    confidence = 'low';
    evidence.push('No build log lines available yet');
    suggestedAction =
      'Refresh build logs. If still empty, open the deployment in Vercel dashboard.';
  } else {
    const tail = logLines
      .slice(-5)
      .map((l) => l.text.trim())
      .filter(Boolean);
    if (tail.length) {
      evidence.push(`Log tail: ${tail[tail.length - 1]!.slice(0, 160)}`);
    }
    likelyCause = 'Build failed — see log evidence';
    confidence = 'low';
  }

  let comparedWith: string | null = null;
  if (lastSuccess && isSuccessState(lastSuccess.state)) {
    comparedWith = `${lastSuccess.id} (${
      lastSuccess.meta.githubCommitSha?.slice(0, 7) ?? 'ready'
    })`;
    if (
      lastSuccess.meta.githubCommitSha &&
      failed.meta.githubCommitSha &&
      lastSuccess.meta.githubCommitSha !== failed.meta.githubCommitSha
    ) {
      evidence.push(
        `Commit changed since last success: ${lastSuccess.meta.githubCommitSha.slice(
          0,
          7,
        )} → ${failed.meta.githubCommitSha.slice(0, 7)}`,
      );
    }
  }

  const headline = isFailedState(failed.state)
    ? `Deployment failed: ${failed.name}`
    : `Deployment ${failed.state}: ${failed.name}`;

  return {
    headline,
    likelyCause,
    evidence,
    comparedWith,
    suggestedAction,
    confidence,
    commitSubject,
    commitSha,
  };
}

export function formatIncidentSummaryText(s: IncidentSummary): string {
  const lines = [
    s.headline,
    '',
    `Likely cause: ${s.likelyCause ?? 'Unknown (low signal)'}`,
    `Confidence: ${s.confidence}`,
    '',
    'Evidence:',
    ...s.evidence.map((e) => `- ${e}`),
  ];
  if (s.comparedWith) {
    lines.push('', `Compared with last successful: ${s.comparedWith}`);
  }
  lines.push('', `Suggested action: ${s.suggestedAction}`);
  return lines.join('\n');
}
