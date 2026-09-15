import { useCallback, useMemo, useState, type MutableRefObject } from 'react';
import type { ProjectID, TeamID } from '../domain/models/ids';
import type {
  ActivityItem,
  EnvVarMeta,
  VercelDeploymentSummary,
  VercelProject,
} from '../domain/models/vercelModels';
import {
  compareDeployments,
  pickBaselineDeployment,
  type DeploymentDiff,
} from '../domain/analysis/deploymentCompare';
import { type FunctionsInventoryReport } from '../domain/analysis/deploymentFunctions';
import { type DomainDiagnosticsReport } from '../domain/analysis/domainDiagnostics';
import { analyzeEnvDrift, type EnvDriftReport } from '../domain/analysis/envDrift';
import { buildFeatureFlagsReport, type FeatureFlagsReport } from '../domain/analysis/featureFlags';
import { explainFirewall, type FirewallExplanation } from '../domain/analysis/firewallExplain';
import {
  formatIncidentSummaryText,
  summarizeFailedDeployment,
  type IncidentSummary,
} from '../domain/analysis/incidentSummary';
import {
  buildObservabilitySnapshot,
  type ObservabilitySnapshot,
} from '../domain/analysis/observability';
import { isFailedState } from '../domain/analysis/projectHealth';
import { parseRuntimeLogQuery, type RuntimeLogReport } from '../domain/analysis/runtimeLogs';
import type { VercelAPIClient } from '../services/api/vercelAPIClient';
import { activity } from './activityItem';
import { runGuardedJob } from './guardedJob';

type OpsQueryDeps = {
  generationRef: MutableRefObject<number>;
  setBusyKey: (key: string | null) => void;
  setLastError: (message: string | null) => void;
  ensureApi: () => Promise<VercelAPIClient>;
  appendActivity: (item: ActivityItem) => Promise<void>;
  teamId: TeamID | null;
  selectedProjectId: ProjectID | null;
  selectedDeployment: VercelDeploymentSummary | null;
  deployments: VercelDeploymentSummary[];
  projects: VercelProject[];
};

export function useOpsQueries(deps: OpsQueryDeps) {
  const {
    generationRef,
    setBusyKey,
    setLastError,
    ensureApi,
    appendActivity,
    teamId,
    selectedProjectId,
    selectedDeployment,
    deployments,
    projects,
  } = deps;

  const [buildLogs, setBuildLogs] = useState<
    { text: string; type?: string | null }[]
  >([]);
  const [envMeta, setEnvMeta] = useState<EnvVarMeta[]>([]);
  const [envDrift, setEnvDrift] = useState<EnvDriftReport | null>(null);
  const [incident, setIncident] = useState<IncidentSummary | null>(null);
  const [domainReport, setDomainReport] =
    useState<DomainDiagnosticsReport | null>(null);
  const [deploymentDiff, setDeploymentDiff] = useState<DeploymentDiff | null>(
    null,
  );
  const [observability, setObservability] =
    useState<ObservabilitySnapshot | null>(null);
  const [firewall, setFirewall] = useState<FirewallExplanation | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagsReport | null>(
    null,
  );
  const [runtimeLogs, setRuntimeLogs] = useState<RuntimeLogReport | null>(null);
  const [deploymentFunctions, setDeploymentFunctions] =
    useState<FunctionsInventoryReport | null>(null);

  const runJob = useCallback(
    (busyKey: string, work: (stillCurrent: () => boolean) => Promise<void>) =>
      runGuardedJob(generationRef, setBusyKey, setLastError, busyKey, work),
    [generationRef, setBusyKey, setLastError],
  );

  const loadBuildLogs = useCallback(async () => {
    if (!selectedDeployment) return;
    await runJob('logs', async (stillCurrent) => {
      const api = await ensureApi();
      const lines = await api.getBuildLogLines(selectedDeployment.id, teamId, 120);
      if (!stillCurrent()) return;
      setBuildLogs(lines);
      await appendActivity(
        activity(
          'load_logs',
          'Loaded build logs',
          `${lines.length} line(s)`,
          'success',
          {
            deploymentId: selectedDeployment.id,
            projectId: selectedProjectId,
          },
        ),
      );
    });
  }, [
    appendActivity,
    ensureApi,
    runJob,
    selectedDeployment,
    selectedProjectId,
    teamId,
  ]);

  const runEnvDriftCheck = useCallback(async () => {
    if (!selectedProjectId) return;
    await runJob('env-drift', async (stillCurrent) => {
      const api = await ensureApi();
      const envs = await api.listEnvVarMeta(selectedProjectId, teamId);
      if (!stillCurrent()) return;
      setEnvMeta(envs);
      const report = analyzeEnvDrift(envs);
      setEnvDrift(report);
      await appendActivity(
        activity(
          'env_drift',
          'Env drift check',
          report.summary,
          report.findings.some((finding) => finding.severity === 'critical')
            ? 'failure'
            : 'success',
          { projectId: selectedProjectId },
        ),
      );
    });
  }, [appendActivity, ensureApi, runJob, selectedProjectId, teamId]);

  const runIncidentSummary = useCallback(async () => {
    if (!selectedProjectId) return;
    const failed =
      selectedDeployment && isFailedState(selectedDeployment.state)
        ? selectedDeployment
        : deployments.find((d) => isFailedState(d.state)) ?? selectedDeployment;
    if (!failed) return;
    await runJob('incident', async (stillCurrent) => {
      const api = await ensureApi();
      let logs = buildLogs;
      if (logs.length === 0 || failed.id !== selectedDeployment?.id) {
        logs = await api.getBuildLogLines(failed.id, teamId, 80);
        if (!stillCurrent()) return;
        setBuildLogs(logs);
      }
      const lastSuccess =
        deployments.find((d) => d.state === 'READY' && d.id !== failed.id) ??
        null;
      let missingProductionEnvKeys: string[] = [];
      try {
        const envs =
          envMeta.length > 0
            ? envMeta
            : await api.listEnvVarMeta(selectedProjectId, teamId);
        if (!stillCurrent()) return;
        if (envMeta.length === 0) setEnvMeta(envs);
        missingProductionEnvKeys = analyzeEnvDrift(envs)
          .findings.filter((finding) => finding.kind === 'missing_in_production')
          .map((finding) => finding.key);
      } catch {
        missingProductionEnvKeys = [];
      }
      const summary = summarizeFailedDeployment({
        failed,
        lastSuccess,
        logLines: logs,
        missingProductionEnvKeys,
      });
      setIncident(summary);
      await appendActivity(
        activity(
          'incident_summary',
          summary.headline,
          formatIncidentSummaryText(summary),
          isFailedState(failed.state) ? 'failure' : 'info',
          { projectId: selectedProjectId, deploymentId: failed.id },
        ),
      );
    });
  }, [
    appendActivity,
    buildLogs,
    deployments,
    ensureApi,
    envMeta,
    runJob,
    selectedDeployment,
    selectedProjectId,
    teamId,
  ]);

  const runDomainDiagnostics = useCallback(async () => {
    if (!selectedProjectId) return;
    await runJob('domains', async (stillCurrent) => {
      const api = await ensureApi();
      const report = await api.diagnoseDomains(selectedProjectId, teamId);
      if (!stillCurrent()) return;
      setDomainReport(report);
      await appendActivity(
        activity(
          'domain_diagnostics',
          'Domain diagnostics',
          report.summary,
          report.domains.some((domain) => domain.severity === 'critical')
            ? 'failure'
            : 'success',
          { projectId: selectedProjectId },
        ),
      );
    });
  }, [appendActivity, ensureApi, runJob, selectedProjectId, teamId]);

  const runDeploymentCompare = useCallback(async () => {
    if (!selectedDeployment) return;
    await runJob('compare', async (stillCurrent) => {
      const baseline = pickBaselineDeployment(selectedDeployment, deployments);
      if (!baseline) {
        setLastError('No successful baseline deployment to compare against.');
        return;
      }
      const api = await ensureApi();
      const [current, base] = await Promise.all([
        api.getDeployment(selectedDeployment.id, teamId),
        api.getDeployment(baseline.id, teamId),
      ]);
      if (!stillCurrent()) return;
      const diff = compareDeployments(current, base);
      setDeploymentDiff(diff);
      await appendActivity(
        activity(
          'deployment_compare',
          `Compare risk ${diff.riskLevel}`,
          diff.summary,
          diff.riskLevel === 'high' ? 'failure' : 'info',
          {
            projectId: selectedProjectId,
            deploymentId: selectedDeployment.id,
          },
        ),
      );
    });
  }, [
    appendActivity,
    deployments,
    ensureApi,
    runJob,
    selectedDeployment,
    selectedProjectId,
    setLastError,
    teamId,
  ]);

  const runObservability = useCallback(async () => {
    if (!selectedProjectId) return;
    await runJob('observability', async (stillCurrent) => {
      const api = await ensureApi();
      const raw = await api.fetchObservability(selectedProjectId, teamId);
      if (!stillCurrent()) return;
      const snap = buildObservabilitySnapshot(raw);
      setObservability(snap);
      await appendActivity(
        activity(
          'observability',
          snap.headline,
          snap.bullets.join('\n'),
          raw.kind === 'ok' ? 'success' : 'info',
          { projectId: selectedProjectId },
        ),
      );
    });
  }, [appendActivity, ensureApi, runJob, selectedProjectId, teamId]);

  const runFirewallExplain = useCallback(async () => {
    if (!selectedProjectId) return;
    await runJob('firewall', async (stillCurrent) => {
      const api = await ensureApi();
      const fw = await api.fetchFirewallStats(selectedProjectId, teamId);
      if (!stillCurrent()) return;
      const explanation = explainFirewall({
        current: fw.current,
        previous: fw.previous,
        availability: fw.availability,
        note: fw.note,
      });
      setFirewall(explanation);
      await appendActivity(
        activity(
          'firewall',
          explanation.headline,
          explanation.bullets.join('\n'),
          'info',
          { projectId: selectedProjectId },
        ),
      );
    });
  }, [appendActivity, ensureApi, runJob, selectedProjectId, teamId]);

  const runFeatureFlags = useCallback(async () => {
    if (!selectedProjectId) return;
    await runJob('flags', async (stillCurrent) => {
      const api = await ensureApi();
      const fl = await api.listFeatureFlags(selectedProjectId, teamId);
      if (!stillCurrent()) return;
      const report = buildFeatureFlagsReport({
        flags: fl.flags,
        availability: fl.availability,
        note: fl.note,
      });
      setFeatureFlags(report);
      await appendActivity(
        activity(
          'feature_flags',
          report.summary,
          report.bullets.join('\n'),
          'info',
          { projectId: selectedProjectId },
        ),
      );
    });
  }, [appendActivity, ensureApi, runJob, selectedProjectId, teamId]);

  const runRuntimeLogQuery = useCallback(
    async (phrase?: string) => {
      if (!selectedProjectId) return;
      await runJob('runtime-logs', async (stillCurrent) => {
        const api = await ensureApi();
        let query = parseRuntimeLogQuery(
          phrase ?? 'production 5xx errors since this morning',
        );
        const phraseLower = (phrase ?? '').toLowerCase();
        if (
          selectedDeployment?.readyAt != null &&
          phraseLower.includes('since deploy')
        ) {
          query = {
            ...query,
            sinceMs: selectedDeployment.readyAt,
            label: 'Errors since selected deployment readyAt',
          };
        }
        const list = await api.listDeployments(selectedProjectId, teamId, 25);
        if (!stillCurrent()) return;
        const pinToSelected =
          phraseLower.includes('this deploy') ||
          phraseLower.includes('selected') ||
          phraseLower.includes('since deploy');
        const deploymentId =
          (pinToSelected ? selectedDeployment?.id : null) ??
          list.find(
            (d) =>
              d.state === 'READY' &&
              (d.target === query.environment ||
                (query.environment === 'production' &&
                  d.target === 'production')),
          )?.id ??
          list.find((d) => d.state === 'READY')?.id ??
          selectedDeployment?.id ??
          null;
        if (!deploymentId) {
          setLastError('No deployment available for runtime log query.');
          return;
        }
        const report = await api.queryRuntimeLogs(
          selectedProjectId,
          deploymentId,
          teamId,
          query,
        );
        if (!stillCurrent()) return;
        setRuntimeLogs(report);
        await appendActivity(
          activity(
            'runtime_logs',
            report.summary,
            report.bullets.join('\n'),
            report.errorCount > 0 ? 'failure' : 'info',
            {
              projectId: selectedProjectId,
              deploymentId: report.deploymentId ?? deploymentId,
            },
          ),
        );
      });
    },
    [
      appendActivity,
      ensureApi,
      runJob,
      selectedDeployment,
      selectedProjectId,
      setLastError,
      teamId,
    ],
  );

  const resetAll = useCallback(() => {
    setBuildLogs([]);
    setEnvMeta([]);
    setEnvDrift(null);
    setIncident(null);
    setDomainReport(null);
    setDeploymentDiff(null);
    setObservability(null);
    setFirewall(null);
    setFeatureFlags(null);
    setRuntimeLogs(null);
    setDeploymentFunctions(null);
  }, []);

  const resetForProjectChange = useCallback(() => {
    setBuildLogs([]);
    setEnvDrift(null);
    setIncident(null);
    setDomainReport(null);
    setDeploymentDiff(null);
    setObservability(null);
    setFirewall(null);
    setFeatureFlags(null);
    setRuntimeLogs(null);
    setDeploymentFunctions(null);
  }, []);

  const resetForDeploymentChange = useCallback(() => {
    setBuildLogs([]);
    setIncident(null);
    setDeploymentFunctions(null);
  }, []);

  const clearFunctions = useCallback(() => {
    setDeploymentFunctions(null);
  }, []);

  const loadDeploymentFunctions = useCallback(async () => {
    if (!selectedDeployment) return;
    await runJob('functions', async (stillCurrent) => {
      const api = await ensureApi();
      const nodeVersion =
        projects.find((project) => project.id === selectedProjectId)
          ?.nodeVersion ?? null;
      const report = await api.fetchDeploymentFunctions(
        selectedDeployment.id,
        teamId,
        {
          lambdaOutputs: selectedDeployment.lambdaOutputs ?? null,
          nodeVersion,
        },
      );
      if (!stillCurrent()) return;
      setDeploymentFunctions(report);
      const count = report.functions.length;
      await appendActivity(
        activity(
          'inspect_functions',
          report.availability === 'ok'
            ? `${count} function${count === 1 ? '' : 's'}`
            : 'Function inventory unavailable',
          report.note ??
            (report.source === 'none' ? 'No functions published' : report.source),
          report.availability === 'ok' ? 'success' : 'info',
          {
            projectId: selectedProjectId,
            deploymentId: selectedDeployment.id,
          },
        ),
      );
    });
  }, [
    appendActivity,
    ensureApi,
    projects,
    runJob,
    selectedDeployment,
    selectedProjectId,
    teamId,
  ]);

  return useMemo(() => ({
    buildLogs,
    envMeta,
    envDrift,
    incident,
    domainReport,
    deploymentDiff,
    observability,
    firewall,
    featureFlags,
    runtimeLogs,
    deploymentFunctions,
    resetAll,
    resetForProjectChange,
    resetForDeploymentChange,
    clearFunctions,
    loadBuildLogs,
    runEnvDriftCheck,
    runIncidentSummary,
    runDomainDiagnostics,
    runDeploymentCompare,
    runObservability,
    runFirewallExplain,
    runFeatureFlags,
    runRuntimeLogQuery,
    loadDeploymentFunctions,
  }), [
    buildLogs,
    envMeta,
    envDrift,
    incident,
    domainReport,
    deploymentDiff,
    observability,
    firewall,
    featureFlags,
    runtimeLogs,
    deploymentFunctions,
    resetAll,
    resetForProjectChange,
    resetForDeploymentChange,
    clearFunctions,
    loadBuildLogs,
    runEnvDriftCheck,
    runIncidentSummary,
    runDomainDiagnostics,
    runDeploymentCompare,
    runObservability,
    runFirewallExplain,
    runFeatureFlags,
    runRuntimeLogQuery,
    loadDeploymentFunctions,
  ]);
}
