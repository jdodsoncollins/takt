import { describe, expect, it } from 'vitest';
import { compareDeployments } from '../src/domain/analysis/deploymentCompare';
import { deploymentID } from '../src/domain/models/ids';
import type { VercelDeploymentSummary } from '../src/domain/models/vercelModels';

function dep(
  id: string,
  sha: string,
  ref: string,
): VercelDeploymentSummary {
  return {
    id: deploymentID(id),
    url: null,
    name: 'app',
    state: 'READY',
    target: 'production',
    createdAt: Date.now(),
    readyAt: Date.now(),
    buildingAt: Date.now() - 60_000,
    source: null,
    meta: {
      githubCommitSha: sha,
      githubCommitRef: ref,
      githubCommitMessage: 'msg',
    },
    inspectorUrl: null,
    buildDurationMs: 60_000,
  };
}

describe('compareDeployments', () => {
  it('detects commit and branch changes and scores risk', () => {
    const diff = compareDeployments(
      dep('cur', 'bbbbbbb', 'feature'),
      dep('base', 'aaaaaaa', 'main'),
    );
    expect(diff.commitChanged).toBe(true);
    expect(diff.branchChanged).toBe(true);
    expect(diff.bullets.length).toBeGreaterThan(0);
    expect(diff.riskScore).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(diff.riskLevel);
  });

  it('reports unchanged commit with low risk', () => {
    const diff = compareDeployments(
      dep('cur', 'aaaaaaa', 'main'),
      dep('base', 'aaaaaaa', 'main'),
    );
    expect(diff.commitChanged).toBe(false);
    expect(diff.summary).toContain('unchanged');
    expect(diff.riskLevel).toBe('low');
    expect(diff.similarityScore).toBe(100);
  });

  it('does not glue the commit body into the summary', () => {
    const current = dep('cur', 'bbbbbbb', 'main');
    current.meta.githubCommitMessage =
      'Center the rings\n\nThey were sitting too low under the gloss';
    const diff = compareDeployments(current, dep('base', 'aaaaaaa', 'main'));
    expect(diff.summary).toBe('Commit changed');
    expect(diff.summary).not.toMatch(/sitting too low/);
    expect(diff.bullets.some((b) => b.startsWith('Subject: Center the rings'))).toBe(
      true,
    );
  });
});

