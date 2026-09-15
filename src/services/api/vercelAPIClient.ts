import {
  deploymentID,
  projectID,
  teamID,
  type DeploymentID,
  type ProjectID,
  type TeamID,
} from '../../domain/models/ids';
import type {
  EnvVarMeta,
  VercelDeploymentSummary,
  VercelProject,
  VercelTeam,
  VercelUser,
} from '../../domain/models/vercelModels';
import {
  computeAttention,
  mapDeploymentState,
  summarizeDeployments,
} from '../../domain/analysis/projectHealth';
import type {
  DomainConfigMeta,
  DomainDiagnosticsReport,
  ProjectDomainMeta,
} from '../../domain/analysis/domainDiagnostics';
import { buildDomainDiagnosticsReport } from '../../domain/analysis/domainDiagnostics';
import type { ObservabilityFetchResult } from '../../domain/analysis/observability';
import type { FirewallPeriodStats } from '../../domain/analysis/firewallExplain';
import type { FeatureFlagMeta } from '../../domain/analysis/featureFlags';
import type { DataAvailability } from '../../domain/models/vercelModels';
import type {
  RuntimeLogEntry,
  RuntimeLogQuery,
} from '../../domain/analysis/runtimeLogs';
import {
  buildRuntimeLogReport,
  normalizeRuntimeLogRow,
  type RuntimeLogReport,
} from '../../domain/analysis/runtimeLogs';
import {
  buildFunctionsInventory,
  formatNodeRuntime,
  type DeploymentFileNode,
  type FunctionsInventoryReport,
  type LambdaOutputRow,
} from '../../domain/analysis/deploymentFunctions';
import { VercelAPIError } from './errors';

const DEFAULT_BASE = 'https://api.vercel.com';
const MAX_PAGES = 100;
const MAX_RUNTIME_LOG_BYTES = 2 * 1024 * 1024;
const MAX_RUNTIME_LOG_LINE_BYTES = 64 * 1024;
const MAX_RUNTIME_LOG_LINES = 5_000;
/** Live tails never close; take a short snapshot so the UI is not stuck. */
export const RUNTIME_LOG_STREAM_MS = 5_000;

type TokenProvider = () => Promise<string | null>;

export interface VercelAPIClient {
  getUser(): Promise<VercelUser>;
  listTeams(): Promise<VercelTeam[]>;
  listProjects(teamId: TeamID | null): Promise<VercelProject[]>;
  listDeployments(
    projectId: ProjectID,
    teamId: TeamID | null,
    limit?: number,
  ): Promise<VercelDeploymentSummary[]>;
  getDeployment(
    id: DeploymentID,
    teamId: TeamID | null,
  ): Promise<VercelDeploymentSummary>;
  getBuildLogLines(
    id: DeploymentID,
    teamId: TeamID | null,
    limit?: number,
  ): Promise<{ text: string; type?: string | null; created?: number | null }[]>;
  listEnvVarMeta(
    projectId: ProjectID,
    teamId: TeamID | null,
  ): Promise<EnvVarMeta[]>;
  /** Create a redeploy from an existing deployment. Never claims success until READY. */
  redeploy(
    deploymentId: DeploymentID,
    projectId: ProjectID,
    teamId: TeamID | null,
    opts?: { target?: 'production' | 'preview' | null },
  ): Promise<VercelDeploymentSummary>;
  diagnoseDomains(
    projectId: ProjectID,
    teamId: TeamID | null,
  ): Promise<DomainDiagnosticsReport>;
  fetchObservability(
    projectId: ProjectID,
    teamId: TeamID | null,
  ): Promise<ObservabilityFetchResult>;
  fetchFirewallStats(
    projectId: ProjectID,
    teamId: TeamID | null,
  ): Promise<{
    availability: DataAvailability;
    current: FirewallPeriodStats | null;
    previous: FirewallPeriodStats | null;
    note?: string;
  }>;
  listFeatureFlags(
    projectId: ProjectID,
    teamId: TeamID | null,
  ): Promise<{
    availability: DataAvailability;
    flags: FeatureFlagMeta[] | null;
    note?: string;
  }>;
  /**
   * Runtime logs for a deployment with validated filters applied client-side.
   * Soft-fails to honest availability when API unavailable.
   */
  queryRuntimeLogs(
    projectId: ProjectID,
    deploymentId: DeploymentID,
    teamId: TeamID | null,
    query: RuntimeLogQuery,
  ): Promise<RuntimeLogReport>;
  /**
   * Function inventory for a deployment. File tree is optional; 404 is
   * an honest empty, not a hard failure.
   */
  fetchDeploymentFunctions(
    id: DeploymentID,
    teamId: TeamID | null,
    opts?: {
      lambdaOutputs?: LambdaOutputRow[] | null;
      nodeVersion?: string | null;
    },
  ): Promise<FunctionsInventoryReport>;
}

export class VercelAPIClientImpl implements VercelAPIClient {
  private readonly baseURL: string;
  private readonly tokenProvider: TokenProvider;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: {
    tokenProvider: TokenProvider;
    baseURL?: string;
    fetchImpl?: typeof fetch;
  }) {
    this.baseURL = opts.baseURL ?? DEFAULT_BASE;
    this.tokenProvider = opts.tokenProvider;
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  async getUser(): Promise<VercelUser> {
    const data = await this.requestJSON<{
      user?: {
        id?: string;
        name?: string | null;
        username?: string;
        email?: string | null;
      };
    }>('/v2/user');
    const u = data.user;
    if (!u?.id || !u.username) {
      throw VercelAPIError.decodeFailed('user', 'missing id/username');
    }
    return {
      id: u.id,
      name: u.name ?? null,
      username: u.username,
      email: u.email ?? null,
    };
  }

  async listTeams(): Promise<VercelTeam[]> {
    type TeamsPage = {
      teams?: Array<{ id?: string; name?: string; slug?: string }>;
      pagination?: { next?: number | null };
    };
    const teams: NonNullable<TeamsPage['teams']> = [];
    let until: number | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const params = new URLSearchParams({ limit: '100' });
      if (until != null) params.set('until', String(until));
      const data = await this.requestJSON<TeamsPage>(
        `/v2/teams?${params.toString()}`,
      );
      teams.push(...(data.teams ?? []));
      const next = data.pagination?.next ?? null;
      if (next == null || next === until) break;
      until = next;
    }
    return teams
      .filter((t): t is { id: string; name: string; slug: string } =>
        Boolean(t.id && t.name && t.slug),
      )
      .map((t) => ({
        id: teamID(t.id),
        name: t.name,
        slug: t.slug,
      }));
  }

  async listProjects(teamId: TeamID | null): Promise<VercelProject[]> {
    type RawProject = {
      id?: string;
      name?: string;
      framework?: string | null;
      nodeVersion?: string | null;
      targets?: {
        production?: {
          id?: string;
          url?: string;
          readyState?: string;
          createdAt?: number;
          meta?: Record<string, string>;
        };
      };
      latestDeployments?: Array<Record<string, unknown>>;
      link?: { type?: string; repo?: string; org?: string };
    };
    const rawProjects: RawProject[] = [];
    let from: string | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const params = new URLSearchParams({ limit: '100' });
      if (teamId) params.set('teamId', teamId);
      if (from) params.set('from', from);
      const data = await this.requestJSON<
        | RawProject[]
        | {
            projects?: RawProject[];
            pagination?: { next?: string | number | null };
          }
      >(`/v10/projects?${params.toString()}`);
      if (Array.isArray(data)) {
        rawProjects.push(...data);
        break;
      }
      rawProjects.push(...(data.projects ?? []));
      const next = data.pagination?.next;
      if (next == null || String(next) === from) break;
      from = String(next);
    }

    // No per-project listDeployments (N+1). Prefer embedded
    // latestDeployments + targets.production from the projects list.
    const projects: VercelProject[] = [];
    for (const p of rawProjects) {
      if (!p.id || !p.name) continue;
      const pid = projectID(p.id);

      const embedded = (p.latestDeployments ?? [])
        .map((d) => mapRawDeployment(d))
        .filter((d): d is VercelDeploymentSummary => d != null);
      const summarized = summarizeDeployments(embedded);
      const prodFromTarget = p.targets?.production
        ? mapRawDeployment({
            ...(p.targets.production as Record<string, unknown>),
            target: 'production',
          })
        : null;
      const production =
        summarized.production ??
        (prodFromTarget
          ? { ...prodFromTarget, target: 'production' as const }
          : null);

      const attention = computeAttention({
        production: production ?? summarized.production,
        latest: summarized.latest ?? production,
        lastSuccess: summarized.lastSuccess,
        latestFailed: summarized.latestFailed,
      });

      const primaryDomain =
        production?.aliases?.[0] ??
        production?.url ??
        summarized.latest?.url ??
        null;

      projects.push({
        id: pid,
        name: p.name,
        framework: p.framework ?? null,
        nodeVersion: p.nodeVersion ?? null,
        primaryDomain,
        productionDeployment: production ?? summarized.production,
        latestDeployment: summarized.latest ?? production,
        lastSuccessfulDeployment: summarized.lastSuccess,
        latestFailedDeployment: summarized.latestFailed,
        needsAttention: attention.needsAttention,
        attentionReason: attention.attentionReason,
        teamId,
        link: p.link
          ? {
              type: p.link.type ?? 'unknown',
              repo: p.link.repo,
              org: p.link.org,
            }
          : null,
      });
    }

    // Needs attention first
    projects.sort((a, b) => {
      if (a.needsAttention !== b.needsAttention) {
        return a.needsAttention ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    return projects;
  }

  async listDeployments(
    projectId: ProjectID,
    teamId: TeamID | null,
    limit = 20,
  ): Promise<VercelDeploymentSummary[]> {
    const requested = Math.max(1, Math.floor(limit));
    const deployments: Array<Record<string, unknown>> = [];
    let until: number | null = null;
    for (
      let page = 0;
      page < MAX_PAGES && deployments.length < requested;
      page += 1
    ) {
      const params = new URLSearchParams({
        projectId,
        limit: String(Math.min(100, requested - deployments.length)),
      });
      if (teamId) params.set('teamId', teamId);
      if (until != null) params.set('until', String(until));
      const data = await this.requestJSON<{
        deployments?: Array<Record<string, unknown>>;
        pagination?: { next?: number | null };
      }>(`/v7/deployments?${params.toString()}`);
      deployments.push(...(data.deployments ?? []));
      const next = data.pagination?.next ?? null;
      if (next == null || next === until) break;
      until = next;
    }
    return deployments
      .map((d) => mapRawDeployment(d))
      .filter((d): d is VercelDeploymentSummary => d != null)
      .slice(0, requested);
  }

  async getDeployment(
    id: DeploymentID,
    teamId: TeamID | null,
  ): Promise<VercelDeploymentSummary> {
    const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
    const data = await this.requestJSON<Record<string, unknown>>(
      `/v13/deployments/${encodeURIComponent(id)}${q}`,
    );
    const mapped = mapRawDeployment(data);
    if (!mapped) {
      throw VercelAPIError.decodeFailed('deployment', 'missing id');
    }
    // Build duration when both timestamps exist
    const buildingAt =
      typeof data.buildingAt === 'number' ? data.buildingAt : mapped.buildingAt;
    const ready =
      typeof data.ready === 'number'
        ? data.ready
        : typeof data.readySubstate === 'number'
          ? null
          : mapped.readyAt;
    if (buildingAt != null && ready != null && ready >= buildingAt) {
      mapped.buildDurationMs = ready - buildingAt;
    }
    if (Array.isArray(data.alias)) {
      mapped.aliases = data.alias.filter(
        (a): a is string => typeof a === 'string',
      );
    }
    if (Array.isArray(data.aliasAssigned) === false && data.url) {
      // keep url
    }
    return mapped;
  }

  async getBuildLogLines(
    id: DeploymentID,
    teamId: TeamID | null,
    limit = 100,
  ): Promise<{ text: string; type?: string | null; created?: number | null }[]> {
    const params = new URLSearchParams({ builds: '1', direction: 'forward' });
    if (teamId) params.set('teamId', teamId);
    // Events endpoint streams build events
    type LogEvent = {
      type?: string;
      created?: number;
      payload?: { text?: string; info?: { type?: string }; name?: string };
      text?: string;
    };

    const data = await this.requestJSON<LogEvent[] | { events?: LogEvent[] }>(
      `/v3/deployments/${encodeURIComponent(id)}/events?${params.toString()}`,
    );

    const events: LogEvent[] = Array.isArray(data)
      ? data
      : Array.isArray(data.events)
        ? data.events
        : [];

    const lines: {
      text: string;
      type?: string | null;
      created?: number | null;
    }[] = [];
    for (const e of events) {
      const text =
        e.payload?.text ??
        e.text ??
        (typeof e.payload === 'object' && e.payload
          ? JSON.stringify(e.payload).slice(0, 200)
          : '');
      if (!text) continue;
      lines.push({
        text,
        type: e.type ?? e.payload?.info?.type ?? null,
        created: e.created ?? null,
      });
    }
    if (lines.length > limit) {
      return lines.slice(-limit);
    }
    return lines;
  }

  async listEnvVarMeta(
    projectId: ProjectID,
    teamId: TeamID | null,
  ): Promise<EnvVarMeta[]> {
    const params = new URLSearchParams({ decrypt: 'false' });
    if (teamId) params.set('teamId', teamId);
    type RawEnv = {
      id?: string;
      key?: string;
      type?: string;
      target?: string[] | string;
      gitBranch?: string | null;
      createdAt?: number;
      updatedAt?: number;
      /** Never surface value to callers even if present. */
      value?: string;
    };
    const data = await this.requestJSON<RawEnv[] | { envs?: RawEnv[] }>(
      `/v10/projects/${encodeURIComponent(projectId)}/env?${params.toString()}`,
    );
    const envs = Array.isArray(data) ? data : (data.envs ?? []);

    return envs
      .filter((e): e is { id: string; key: string; type?: string } & typeof e =>
        Boolean(e.id && e.key),
      )
      .map((e) => {
        const target = Array.isArray(e.target)
          ? e.target
          : e.target
            ? [e.target]
            : [];
        return {
          id: e.id!,
          key: e.key!,
          type: e.type ?? 'encrypted',
          target,
          gitBranch: e.gitBranch ?? null,
          createdAt: e.createdAt ?? null,
          updatedAt: e.updatedAt ?? null,
        } satisfies EnvVarMeta;
      });
  }

  async redeploy(
    deploymentId: DeploymentID,
    projectId: ProjectID,
    teamId: TeamID | null,
    opts?: { target?: 'production' | 'preview' | null },
  ): Promise<VercelDeploymentSummary> {
    // Fetch source deployment for project name / meta
    const source = await this.getDeployment(deploymentId, teamId);
    const body: Record<string, unknown> = {
      name: source.name,
      project: projectId,
      deploymentId: source.id,
      meta: {
        action: 'redeploy',
        sourceDeploymentId: source.id,
      },
    };
    if (opts?.target) {
      body.target = opts.target;
    }
    const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
    const data = await this.requestJSON<Record<string, unknown>>(
      `/v13/deployments${q}`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    const mapped = mapRawDeployment(data);
    if (!mapped) {
      throw VercelAPIError.decodeFailed('redeploy', 'missing id in response');
    }
    return mapped;
  }

  async diagnoseDomains(
    projectId: ProjectID,
    teamId: TeamID | null,
  ): Promise<DomainDiagnosticsReport> {
    type DomainPage = {
      domains?: Array<{
        name?: string;
        verified?: boolean;
        redirect?: string | null;
        gitBranch?: string | null;
      }>;
      pagination?: { next?: number | null };
    };
    const listedDomains: NonNullable<DomainPage['domains']> = [];
    let until: number | null = null;
    let listFailure: { ok: false; status: number; detail: string } | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const domainParams = new URLSearchParams({ limit: '100' });
      if (teamId) domainParams.set('teamId', teamId);
      if (until != null) domainParams.set('until', String(until));
      const listed = await this.requestSoft<DomainPage>(
        `/v9/projects/${encodeURIComponent(projectId)}/domains?${domainParams.toString()}`,
      );
      if (!listed.ok) {
        listFailure = listed;
        break;
      }
      listedDomains.push(...(listed.data.domains ?? []));
      const next = listed.data.pagination?.next ?? null;
      if (next == null || next === until) break;
      until = next;
    }

    if (listFailure) {
      const availability = statusToAvailability(listFailure.status);
      return buildDomainDiagnosticsReport(projectId, [], new Map(), {
        availability,
        note: listFailure.detail,
      });
    }

    const domains: ProjectDomainMeta[] = listedDomains
      .filter((d): d is { name: string; verified?: boolean } & typeof d =>
        Boolean(d.name),
      )
      .map((d) => ({
        name: d.name!,
        verified: typeof d.verified === 'boolean' ? d.verified : null,
        redirect: d.redirect ?? null,
        gitBranch: d.gitBranch ?? null,
        environment: null,
      }));

    const configs = new Map<string, DomainConfigMeta | null>();
    const mapped = await Promise.all(
      domains.slice(0, 15).map(async (d) => {
        const cfgQ = new URLSearchParams({ projectIdOrName: projectId });
        if (teamId) cfgQ.set('teamId', teamId);
        const cfg = await this.requestSoft<Record<string, unknown>>(
          `/v6/domains/${encodeURIComponent(d.name)}/config?${cfgQ.toString()}`,
        );
        if (!cfg.ok) return [d.name, null] as const;
        const data = cfg.data;
        const recommendedCNAMERaw = data.recommendedCNAME;
        const configuredByRaw = data.configuredBy;
        const misconfigured =
          typeof data.misconfigured === 'boolean' ? data.misconfigured : null;
        const recommendedIPv4 = Array.isArray(data.recommendedIPv4)
          ? (data.recommendedIPv4 as unknown[]).filter(
              (x): x is string => typeof x === 'string',
            )
          : null;
        const recommendedCNAME = Array.isArray(recommendedCNAMERaw)
          ? (recommendedCNAMERaw as unknown[]).filter(
              (x): x is string => typeof x === 'string',
            )
          : null;
        const cnames =
          recommendedCNAME ??
          (Array.isArray(data.cnames)
            ? (data.cnames as unknown[]).filter(
                (x): x is string => typeof x === 'string',
              )
            : null);
        return [
          d.name,
          {
            misconfigured,
            recommendedIPv4,
            recommendedCNAME: cnames,
            configuredBy:
              typeof configuredByRaw === 'string' ? configuredByRaw : null,
          },
        ] as const;
      }),
    );
    for (const [name, meta] of mapped) configs.set(name, meta);

    return buildDomainDiagnosticsReport(projectId, domains, configs);
  }

  async fetchObservability(
    _projectId: ProjectID,
    _teamId: TeamID | null,
  ): Promise<ObservabilityFetchResult> {
    return {
      kind: 'temporarily_unavailable',
      detail: 'Vercel does not publish a REST API contract for analytics metrics.',
    };
  }

  async fetchFirewallStats(
    projectId: ProjectID,
    _teamId: TeamID | null,
  ): Promise<{
    availability: DataAvailability;
    current: FirewallPeriodStats | null;
    previous: FirewallPeriodStats | null;
    note?: string;
  }> {
    const now = Date.now();
    const q = new URLSearchParams({
      projectId,
      startTimestamp: String(now - 24 * 3600_000),
      endTimestamp: String(now),
    });
    const res = await this.requestSoft<{
      actions?: Array<{
        action_type?: string;
        count?: number;
        host?: string;
      }>;
    }>(
      `/v1/security/firewall/events?${q.toString()}`,
    );
    if (!res.ok) {
      return {
        availability: statusToAvailability(res.status),
        current: null,
        previous: null,
        note: res.detail,
      };
    }
    const current = mapFirewallActions(res.data.actions ?? []);
    if (!current) {
      return {
        availability: 'no_data',
        current: null,
        previous: null,
        note: 'Vercel returned no firewall actions for this period.',
      };
    }
    return {
      availability: 'ok',
      current,
      previous: null,
    };
  }

  async listFeatureFlags(
    _projectId: ProjectID,
    _teamId: TeamID | null,
  ): Promise<{
    availability: DataAvailability;
    flags: FeatureFlagMeta[] | null;
    note?: string;
  }> {
    return {
      availability: 'temporarily_unavailable',
      flags: null,
      note: 'Vercel does not publish a REST API contract for listing feature flags.',
    };
  }

  async queryRuntimeLogs(
    projectId: ProjectID,
    deploymentId: DeploymentID,
    teamId: TeamID | null,
    query: RuntimeLogQuery,
  ): Promise<RuntimeLogReport> {
    const params = new URLSearchParams();
    if (teamId) params.set('teamId', teamId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const path = `/v1/projects/${encodeURIComponent(projectId)}/deployments/${encodeURIComponent(deploymentId)}/runtime-logs${qs}`;
    const res = await this.requestRuntimeLogStream(path);

    if (!res.ok) {
      return buildRuntimeLogReport({
        query,
        deploymentId,
        entries: null,
        availability: statusToAvailability(res.status),
        note: res.detail ?? 'Runtime logs API unavailable',
      });
    }

    const entries = res.data.map((row, i) =>
      normalizeRuntimeLogRow(row, i),
    );
    return buildRuntimeLogReport({
      query,
      deploymentId,
      entries,
      availability: 'ok',
    });
  }

  async fetchDeploymentFunctions(
    id: DeploymentID,
    teamId: TeamID | null,
    opts?: {
      lambdaOutputs?: LambdaOutputRow[] | null;
      nodeVersion?: string | null;
    },
  ): Promise<FunctionsInventoryReport> {
    const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
    let lambdaOutputs = opts?.lambdaOutputs ?? null;
    if (lambdaOutputs == null) {
      const detail = await this.requestSoft<Record<string, unknown>>(
        `/v13/deployments/${encodeURIComponent(id)}${q}`,
      );
      if (!detail.ok) {
        if (detail.status === 401) throw VercelAPIError.unauthorized();
        if (detail.status === 403) throw VercelAPIError.forbidden();
        if (detail.status === 0) {
          return buildFunctionsInventory({
            fileTree: null,
            fileTreeAvailable: false,
            lambdas: [],
          });
        }
        lambdaOutputs = [];
      } else {
        lambdaOutputs = mapLambdaOutputs(detail.data);
      }
    }

    const files = await this.requestSoft<unknown>(
      `/v6/deployments/${encodeURIComponent(id)}/files${q}`,
    );
    if (!files.ok && files.status === 401) throw VercelAPIError.unauthorized();
    if (!files.ok && files.status === 403) throw VercelAPIError.forbidden();

    const fileTreeAvailable = files.ok;
    const fileTree = files.ok ? parseFileTree(files.data) : [];

    return buildFunctionsInventory({
      fileTree,
      fileTreeAvailable,
      lambdas: lambdaOutputs,
      runtimeDefault: formatNodeRuntime(opts?.nodeVersion ?? null),
    });
  }

  private async requireToken(): Promise<string> {
    const token = await this.tokenProvider();
    if (!token) throw VercelAPIError.unauthorized();
    return token;
  }

  private async requestRuntimeLogStream(
    path: string,
  ): Promise<
    | { ok: true; status: number; data: Record<string, unknown>[] }
    | { ok: false; status: number; detail: string }
  > {
    const token = await this.requireToken();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), RUNTIME_LOG_STREAM_MS);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseURL}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/stream+json',
        },
        signal: ac.signal,
      });
    } catch {
      clearTimeout(timer);
      return {
        ok: false,
        status: 0,
        detail: ac.signal.aborted
          ? 'Runtime log tail timed out with no lines.'
          : fixedApiDetail(0),
      };
    }
    if (!res.ok) {
      clearTimeout(timer);
      return {
        ok: false,
        status: res.status,
        detail: fixedApiDetail(res.status),
      };
    }
    const contentType = res.headers
      ?.get('content-type')
      ?.split(';', 1)[0]
      ?.trim();
    if (contentType !== 'application/stream+json') {
      clearTimeout(timer);
      return { ok: false, status: res.status, detail: fixedApiDetail(-1) };
    }
    try {
      const data = await readRuntimeLogStream(res, ac.signal);
      return {
        ok: true,
        status: res.status,
        data,
      };
    } catch {
      return { ok: false, status: res.status, detail: fixedApiDetail(-1) };
    } finally {
      clearTimeout(timer);
    }
  }

  private async requestJSON<T>(
    path: string,
    init?: { method?: string; body?: string },
  ): Promise<T> {
    const soft = await this.requestSoft<T>(path, init);
    if (!soft.ok) {
      if (soft.status === 401) throw VercelAPIError.unauthorized();
      if (soft.status === 403) throw VercelAPIError.forbidden();
      if (soft.status === 404) throw VercelAPIError.notFound(path);
      if (soft.status === 429) throw VercelAPIError.rateLimited();
      if (soft.status === 0) throw VercelAPIError.network();
      throw VercelAPIError.invalidResponse();
    }
    return soft.data;
  }

  /**
   * Soft request for APIs whose availability depends on plan or permissions.
   * Does not throw on 4xx so callers can map honest DataAvailability.
   */
  private async requestSoft<T>(
    path: string,
    init?: { method?: string; body?: string },
  ): Promise<
    | { ok: true; status: number; data: T }
    | { ok: false; status: number; detail: string }
  > {
    const token = await this.requireToken();
    const url = path.startsWith('http') ? path : `${this.baseURL}${path}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: init?.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(init?.body
            ? { 'Content-Type': 'application/json' }
            : undefined),
        },
        body: init?.body,
      });
    } catch {
      return {
        ok: false,
        status: 0,
        detail: fixedApiDetail(0),
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        detail: fixedApiDetail(res.status),
      };
    }

    if (res.status === 204) {
      return { ok: true, status: 204, data: {} as T };
    }

    try {
      const data = (await res.json()) as T;
      return { ok: true, status: res.status, data };
    } catch {
      return {
        ok: false,
        status: res.status,
        detail: fixedApiDetail(-1),
      };
    }
  }
}

function fixedApiDetail(status: number): string {
  if (status === 0) return 'Vercel request failed: NETWORK_ERROR.';
  if (status === -1) return 'Vercel request failed: INVALID_RESPONSE.';
  if (status === 400) return 'Vercel request failed: BAD_REQUEST.';
  if (status === 401) return 'Vercel request failed: UNAUTHORIZED.';
  if (status === 402) return 'Vercel request failed: PAYMENT_REQUIRED.';
  if (status === 403) return 'Vercel request failed: FORBIDDEN.';
  if (status === 404) return 'Vercel request failed: NOT_FOUND.';
  if (status === 410) return 'Vercel request failed: GONE.';
  if (status === 429) return 'Vercel request failed: RATE_LIMITED.';
  if (status >= 500) return 'Vercel request failed: SERVER_ERROR.';
  return 'Vercel request failed: HTTP_ERROR.';
}

export async function readRuntimeLogStream(
  response: Response,
  signal?: AbortSignal,
): Promise<Record<string, unknown>[]> {
  const contentLength = Number(response.headers?.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RUNTIME_LOG_BYTES) {
    throw new Error('runtime log stream exceeds byte limit');
  }

  const rows: Record<string, unknown>[] = [];
  const decoder = new TextDecoder();
  let carry = '';
  let bytes = 0;

  const consume = (text: string, final: boolean) => {
    carry += text;
    const lines = carry.split('\n');
    carry = final ? '' : (lines.pop() ?? '');
    if (
      !final &&
      new TextEncoder().encode(carry).byteLength > MAX_RUNTIME_LOG_LINE_BYTES
    ) {
      throw new Error('runtime log line exceeds byte limit');
    }
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (
        new TextEncoder().encode(line).byteLength > MAX_RUNTIME_LOG_LINE_BYTES
      ) {
        throw new Error('runtime log line exceeds byte limit');
      }
      if (rows.length >= MAX_RUNTIME_LOG_LINES) {
        throw new Error('runtime log stream exceeds line limit');
      }
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) {
        throw new Error('runtime log line is not an object');
      }
      rows.push(parsed as Record<string, unknown>);
    }
  };

  if (response.body) {
    const reader = response.body.getReader();
    const onAbort = () => {
      void reader.cancel();
    };
    signal?.addEventListener('abort', onAbort);
    try {
      while (!signal?.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_RUNTIME_LOG_BYTES) {
          await reader.cancel();
          throw new Error('runtime log stream exceeds byte limit');
        }
        consume(decoder.decode(value, { stream: true }), false);
      }
      consume(decoder.decode(), true);
    } catch (error) {
      if (!signal?.aborted) throw error;
      consume(decoder.decode(), true);
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  } else {
    const text = await response.text();
    bytes = new TextEncoder().encode(text).byteLength;
    if (bytes > MAX_RUNTIME_LOG_BYTES) {
      throw new Error('runtime log stream exceeds byte limit');
    }
    consume(text, true);
  }
  return rows;
}

function statusToAvailability(status: number): DataAvailability {
  if (status === 404 || status === 400) return 'not_enabled';
  if (status === 402 || status === 403) return 'unavailable_for_plan';
  if (status === 429 || status === 0 || status >= 500) {
    return 'temporarily_unavailable';
  }
  return 'temporarily_unavailable';
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function mapFirewallActions(
  actions: Array<{ action_type?: string; count?: number; host?: string }>,
): FirewallPeriodStats | null {
  if (actions.length === 0) return null;
  let allowed = 0;
  let denied = 0;
  let challenged = 0;
  let recognized = false;
  let topDeniedRoute: string | null = null;
  let topDeniedCount = -1;
  for (const action of actions) {
    const type = action.action_type?.toLowerCase() ?? '';
    const count = num(action.count) ?? 0;
    if (/deny|block|rate.?limit/.test(type)) {
      recognized = true;
      denied += count;
      if (count > topDeniedCount) {
        topDeniedCount = count;
        topDeniedRoute = action.host ?? null;
      }
    } else if (/challenge/.test(type)) {
      recognized = true;
      challenged += count;
    } else if (/allow|bypass|log/.test(type)) {
      recognized = true;
      allowed += count;
    }
  }
  if (!recognized) return null;
  return {
    allowed,
    denied,
    challenged,
    topDeniedRoute,
    topCountry: null,
    topRule: null,
  };
}

function mapRawDeployment(
  raw: Record<string, unknown> | null | undefined,
): VercelDeploymentSummary | null {
  if (!raw) return null;
  const id =
    (typeof raw.uid === 'string' && raw.uid) ||
    (typeof raw.id === 'string' && raw.id) ||
    null;
  if (!id) return null;

  const metaRaw =
    raw.meta && typeof raw.meta === 'object'
      ? (raw.meta as Record<string, unknown>)
      : {};

  const stateRaw =
    (typeof raw.readyState === 'string' && raw.readyState) ||
    (typeof raw.state === 'string' && raw.state) ||
    null;

  const targetRaw =
    typeof raw.target === 'string'
      ? raw.target
      : raw.target === null
        ? null
        : null;
  let target: VercelDeploymentSummary['target'] = null;
  if (targetRaw === 'production' || targetRaw === 'preview' || targetRaw === 'development') {
    target = targetRaw;
  }

  const createdAt =
    typeof raw.created === 'number'
      ? raw.created
      : typeof raw.createdAt === 'number'
        ? raw.createdAt
        : Date.now();

  const buildingAt =
    typeof raw.buildingAt === 'number' ? raw.buildingAt : null;
  const readyAt =
    typeof raw.ready === 'number'
      ? raw.ready
      : typeof raw.readyAt === 'number'
        ? raw.readyAt
        : null;

  const url =
    typeof raw.url === 'string'
      ? raw.url.startsWith('http')
        ? raw.url
        : `https://${raw.url}`
      : null;

  return {
    id: deploymentID(id),
    url,
    name:
      typeof raw.name === 'string'
        ? raw.name
        : typeof raw.project === 'string'
          ? raw.project
          : 'deployment',
    state: mapDeploymentState(stateRaw),
    target,
    createdAt,
    readyAt,
    buildingAt,
    source: typeof raw.source === 'string' ? raw.source : null,
    creatorUsername: mapCreatorUsername(raw.creator),
    isRollbackCandidate:
      typeof raw.isRollbackCandidate === 'boolean'
        ? raw.isRollbackCandidate
        : null,
    region: firstRegion(raw.regions),
    meta: {
      githubCommitRef:
        typeof metaRaw.githubCommitRef === 'string'
          ? metaRaw.githubCommitRef
          : null,
      githubCommitSha:
        typeof metaRaw.githubCommitSha === 'string'
          ? metaRaw.githubCommitSha
          : null,
      githubCommitMessage:
        typeof metaRaw.githubCommitMessage === 'string'
          ? metaRaw.githubCommitMessage
          : null,
      githubCommitAuthorName:
        typeof metaRaw.githubCommitAuthorName === 'string'
          ? metaRaw.githubCommitAuthorName
          : null,
      githubCommitAuthorLogin:
        typeof metaRaw.githubCommitAuthorLogin === 'string'
          ? metaRaw.githubCommitAuthorLogin
          : null,
    },
    inspectorUrl:
      typeof raw.inspectorUrl === 'string' ? raw.inspectorUrl : null,
    aliases: Array.isArray(raw.alias)
      ? raw.alias.filter((a): a is string => typeof a === 'string')
      : undefined,
    buildDurationMs:
      buildingAt != null && readyAt != null && readyAt >= buildingAt
        ? readyAt - buildingAt
        : null,
    lambdaOutputs: mapLambdaOutputs(raw),
  };
}

function mapCreatorUsername(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const username = (raw as Record<string, unknown>).username;
  return typeof username === 'string' && username.trim() ? username : null;
}

function firstRegion(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  const first = raw[0];
  return typeof first === 'string' && first.trim() ? first : null;
}

function mapLambdaOutputs(raw: Record<string, unknown>): LambdaOutputRow[] {
  const lambdas = raw.lambdas;
  if (!Array.isArray(lambdas)) return [];
  const out: LambdaOutputRow[] = [];
  const seen = new Set<string>();
  for (const entry of lambdas) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const readyState = typeof rec.readyState === 'string' ? rec.readyState : null;
    const outputs = Array.isArray(rec.output) ? rec.output : [];
    for (const item of outputs) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const path = typeof row.path === 'string' ? row.path : '';
      const functionName =
        typeof row.functionName === 'string' ? row.functionName : '';
      if (!path && !functionName) continue;
      const key = functionName || path;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        path: path || functionName,
        functionName: functionName || path,
        readyState,
      });
    }
  }
  return out;
}

function parseFileTree(raw: unknown): DeploymentFileNode[] {
  const roots = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { files?: unknown }).files)
      ? ((raw as { files: unknown[] }).files)
      : [];
  return roots
    .map((node) => parseFileNode(node))
    .filter((node): node is DeploymentFileNode => node != null);
}

function parseFileNode(raw: unknown): DeploymentFileNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.name !== 'string' || typeof rec.type !== 'string') return null;
  const children = Array.isArray(rec.children)
    ? rec.children
        .map((child) => parseFileNode(child))
        .filter((child): child is DeploymentFileNode => child != null)
    : undefined;
  return {
    name: rec.name,
    type: rec.type,
    uid: typeof rec.uid === 'string' ? rec.uid : null,
    size: typeof rec.size === 'number' ? rec.size : null,
    children,
  };
}
