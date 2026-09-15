import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';
import {
  emptyConnection,
  type ActivityItem,
  type EnvVarMeta,
  type VercelConnection,
  type VercelDeploymentSummary,
  type VercelProject,
} from '../domain/models/vercelModels';
import type { DeploymentID, ProjectID, TeamID } from '../domain/models/ids';
import { newActionPlan } from '../domain/actions/taktAction';
import { ConfirmationPolicy } from '../domain/policies/confirmationPolicy';
import { type DeploymentDiff } from '../domain/analysis/deploymentCompare';
import { pollDeploymentUntilTerminal } from '../domain/analysis/deploymentPoll';
import { type FunctionsInventoryReport } from '../domain/analysis/deploymentFunctions';
import { type DomainDiagnosticsReport } from '../domain/analysis/domainDiagnostics';
import { type EnvDriftReport } from '../domain/analysis/envDrift';
import { type FeatureFlagsReport } from '../domain/analysis/featureFlags';
import { type FirewallExplanation } from '../domain/analysis/firewallExplain';
import { type IncidentSummary } from '../domain/analysis/incidentSummary';
import {
  buildBoundedOpsContext,
  formatOpsNarrative,
  type OpsNarrative,
} from '../domain/analysis/opsNarrative';
import { routeOpsQuery, type OpsRouteResult } from '../domain/analysis/opsRouter';
import {
  containsSecretLike,
  synthesizeOpsNarrativeHybrid,
  type OnDeviceBackend,
} from '../domain/analysis/opsSynthesizer';
import { type ObservabilitySnapshot } from '../domain/analysis/observability';
import {
  computeAttention,
  isFailedState,
  summarizeDeployments,
} from '../domain/analysis/projectHealth';
import { type RuntimeLogReport } from '../domain/analysis/runtimeLogs';
import {
  createOnDeviceBackend,
  probeOnDeviceAvailable,
} from '../services/ai/onDeviceModel';
import { OPS_COMMAND_CATALOG } from '../features/command/opsCommands';
import { resolveOAuthConfig } from '../services/auth/oauthConfig';
import { createRefreshingTokenProvider } from '../services/auth/oauthTokenLifecycle';
import { createPlatformTokenStore } from '../services/auth/secureTokenStore';
import {
  clearAccessToken,
  loadAccessToken,
  loadStoredCredentialRecord,
  loadTokenSource,
  persistAccessToken,
  restoreCredentialIfCurrent,
  TokenStoreKeys,
  type TokenStore,
  type TokenSource,
} from '../services/auth/tokenStore';
import { startVercelOAuth } from '../services/auth/vercelOAuth';
import { DemoVercelAPIClient } from '../services/api/demoAPIClient';
import {
  VercelAPIClientImpl,
  type VercelAPIClient,
} from '../services/api/vercelAPIClient';
import { isDemoMode } from '../support/demoMode';
import {
  DEMO_PROJECT_ID,
  DEMO_TEAM_ID,
  buildDemoActivity,
  buildDemoConnection,
  buildDemoDeployments,
  buildDemoProjects,
} from '../support/demoFixtures';
import { ActivityStore } from '../services/storage/activityStore';
import { createAppKeyValueStore } from '../services/storage/asyncStorageKvStore';
import { ProjectSnapshotStore } from '../services/storage/projectSnapshotStore';
import {
  executeApprovedPlan,
  type ExecutePlanResult,
} from '../services/actions';
import Constants from 'expo-constants';
import {
  deploymentCanBeSelected,
  selectionScopeIsCurrent,
  type SelectionScope,
} from '../domain/models/selectionSafety';
import {
  formatMutationConfirmation,
  mutationConfirmationFor,
} from '../domain/actions/mutationSafety';
import { closeModal, navigateTab, openAssistant, openSettings } from './nav';
import { activity } from './activityItem';
import { useOpsQueries } from './useOpsQueries';

export type AppTab = 'home' | 'deployments' | 'activity';

export type ConnectionAttemptResult =
  | { status: 'connected'; source: TokenSource }
  | { status: 'rejected'; message: string };

export interface AppState {
  connection: VercelConnection;
  projects: VercelProject[];
  selectedProjectId: ProjectID | null;
  deployments: VercelDeploymentSummary[];
  selectedDeployment: VercelDeploymentSummary | null;
  buildLogs: { text: string; type?: string | null }[];
  envMeta: EnvVarMeta[];
  envDrift: EnvDriftReport | null;
  incident: IncidentSummary | null;
  domainReport: DomainDiagnosticsReport | null;
  deploymentDiff: DeploymentDiff | null;
  observability: ObservabilitySnapshot | null;
  firewall: FirewallExplanation | null;
  featureFlags: FeatureFlagsReport | null;
  runtimeLogs: RuntimeLogReport | null;
  deploymentFunctions: FunctionsInventoryReport | null;
  /** Non-null while polling a post-mutator deployment for READY. */
  pollingDeploymentId: string | null;
  /** 0–1 progress while polling; null when idle. */
  pollProgress: number | null;
  pollAttempt: number;
  pollMaxAttempts: number;
  /** ISO timestamp of cached project list, if shown. */
  projectsCachedAt: string | null;
  projectsFromCache: boolean;
  opsNarrative: OpsNarrative | null;
  oauthConfigured: boolean;
  tokenSource: TokenSource | null;
  hasRefreshToken: boolean;
  recentActivity: ActivityItem[];
  activeTab: AppTab;
  settingsOpen: boolean;
  commandOpen: boolean;
  confirmPlanOpen: boolean;
  pendingPlanTitle: string | null;
  lastError: string | null;
  isBusy: boolean;
  /** Which exclusive job is running; other chrome stays tappable. */
  busyKey: string | null;
  isRehydrating: boolean;
  /**
   * True only after a one-shot `expo-ai-kit.isAvailable()` probe.
   * Search tab is hidden until this is true (Apple Intelligence / Gemini Nano).
   */
  onDeviceAvailable: boolean;
}

interface AppContextValue extends AppState {
  setActiveTab: (tab: AppTab) => void;
  setSettingsOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  connectWithToken: (token: string) => Promise<ConnectionAttemptResult>;
  /** PKCE OAuth when client id is configured; otherwise throws with setup hint. */
  connectWithOAuth: () => Promise<ConnectionAttemptResult>;
  disconnect: () => Promise<void>;
  /** Erases local activity, snapshots, selections, and credentials. */
  eraseLocalData: () => Promise<void>;
  /** Local bounded brief from loaded signals (no secrets). */
  runOpsBrief: () => Promise<void>;
  /** On-device Search lookup. No keyword fallback. */
  routeSearchQuery: (query: string) => Promise<OpsRouteResult>;
  selectTeam: (teamId: TeamID | null) => Promise<void>;
  refreshProjects: () => Promise<void>;
  selectProject: (projectId: ProjectID | null) => Promise<void>;
  loadDeployments: (projectId: ProjectID) => Promise<void>;
  selectDeployment: (id: DeploymentID | null) => Promise<void>;
  loadBuildLogs: () => Promise<void>;
  runEnvDriftCheck: () => Promise<void>;
  runIncidentSummary: () => Promise<void>;
  runDomainDiagnostics: () => Promise<void>;
  runDeploymentCompare: () => Promise<void>;
  runObservability: () => Promise<void>;
  runFirewallExplain: () => Promise<void>;
  runFeatureFlags: () => Promise<void>;
  /**
   * Validated runtime log query. Optional free-text is parsed into allow-listed filters.
   */
  runRuntimeLogQuery: (phrase?: string) => Promise<void>;
  loadDeploymentFunctions: () => Promise<void>;
  requestRedeploy: (opts?: {
    target?: 'production' | 'preview' | null;
    mode?: 'redeploy' | 'promote' | 'rollback';
  }) => Promise<void>;
  clearActivity: () => Promise<void>;
  selectedProject: VercelProject | null;
}

const AppContext = createContext<AppContextValue | null>(null);

const kv = createAppKeyValueStore();
const defaultActivityStore = new ActivityStore(kv);
const projectSnapshots = new ProjectSnapshotStore(kv);
const oauthConfig = resolveOAuthConfig(
  (Constants.expoConfig?.extra ?? {}) as {
    vercelClientId?: string;
    oauthRedirectUri?: string;
    vercelOAuthScope?: string;
  },
);

export function AppProvider({ children }: { children: ReactNode }) {
  const tokenStore = useMemo(() => createPlatformTokenStore(), []);
  const tokenProvider = useMemo(
    () =>
      oauthConfig
        ? createRefreshingTokenProvider(tokenStore, oauthConfig)
        : () => loadAccessToken(tokenStore),
    [tokenStore],
  );
  const apiRef = useRef<VercelAPIClient | null>(null);
  const activityStore = defaultActivityStore;

  const [connection, setConnection] = useState<VercelConnection>(() =>
    emptyConnection(),
  );
  const [projects, setProjects] = useState<VercelProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<ProjectID | null>(
    null,
  );
  const [deployments, setDeployments] = useState<VercelDeploymentSummary[]>([]);
  const [selectedDeployment, setSelectedDeployment] =
    useState<VercelDeploymentSummary | null>(null);
  const [pollingDeploymentId, setPollingDeploymentId] = useState<string | null>(
    null,
  );
  const [pollProgress, setPollProgress] = useState<number | null>(null);
  const [pollAttempt, setPollAttempt] = useState(0);
  const pollMaxAttempts = 45;
  const [projectsCachedAt, setProjectsCachedAt] = useState<string | null>(null);
  const [projectsFromCache, setProjectsFromCache] = useState(false);
  const [opsNarrative, setOpsNarrative] = useState<OpsNarrative | null>(null);
  const [tokenSource, setTokenSource] = useState<TokenSource | null>(null);
  const [hasRefreshToken, setHasRefreshToken] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const recentActivityRef = useRef<ActivityItem[]>([]);
  const pollCancelRef = useRef(0);
  const generationRef = useRef(0);
  const selectedTeamIdRef = useRef<TeamID | null>(null);
  const selectedProjectIdRef = useRef<ProjectID | null>(null);
  const deploymentsProjectIdRef = useRef<ProjectID | null>(null);
  const deploymentsRef = useRef<VercelDeploymentSummary[]>([]);
  const selectionWriteRef = useRef<Promise<void> | null>(null);
  const [activeTab, setActiveTabState] = useState<AppTab>('home');
  const [settingsOpen, setSettingsOpenState] = useState(false);
  const [commandOpen, setCommandOpenState] = useState(false);
  const [isRehydrating, setIsRehydrating] = useState(true);
  const [onDeviceAvailable, setOnDeviceAvailable] = useState(false);

  const setActiveTab = useCallback((tab: AppTab) => {
    setActiveTabState(tab);
    navigateTab(tab);
  }, []);

  const setSettingsOpen = useCallback((open: boolean) => {
    setSettingsOpenState(open);
    if (open) openSettings();
    else closeModal();
  }, []);

  const setCommandOpen = useCallback((open: boolean) => {
    setCommandOpenState(open);
    if (open && onDeviceAvailable) openAssistant();
  }, [onDeviceAvailable]);
  const [confirmPlanOpen, setConfirmPlanOpen] = useState(false);
  const [pendingPlanTitle, setPendingPlanTitle] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const isBusy = busyKey != null;
  const onDeviceBackendRef = useRef<Promise<OnDeviceBackend | null> | null>(null);

  const appendActivity = useCallback(async (item: ActivityItem) => {
    const next = [item, ...recentActivityRef.current].slice(0, ActivityStore.maxItems);
    recentActivityRef.current = next;
    setRecentActivity(next);
    if (!isDemoMode) await activityStore.append(item);
  }, [activityStore]);

  const currentScope = useCallback((): SelectionScope => ({
    generation: generationRef.current,
    teamId: selectedTeamIdRef.current,
    projectId: selectedProjectIdRef.current,
  }), []);

  const invalidateWork = useCallback(() => {
    generationRef.current += 1;
    pollCancelRef.current += 1;
    return generationRef.current;
  }, []);

  const persistSelection = useCallback((write: () => Promise<void>) => {
    if (isDemoMode) return Promise.resolve();
    const prior = selectionWriteRef.current ?? Promise.resolve();
    const result = prior.then(write, write);
    selectionWriteRef.current = result.catch(() => undefined);
    return result;
  }, []);

  const ensureApi = useCallback(async (): Promise<VercelAPIClient> => {
    if (apiRef.current) return apiRef.current;
    const client = isDemoMode
      ? new DemoVercelAPIClient()
      : new VercelAPIClientImpl({
          tokenProvider: () => tokenProvider(),
        });
    apiRef.current = client;
    return client;
  }, []);

  const ops = useOpsQueries({
    generationRef,
    setBusyKey,
    setLastError,
    ensureApi,
    appendActivity,
    teamId: connection.selectedTeamId,
    selectedProjectId,
    selectedDeployment,
    deployments,
    projects,
  });

  const finishConnect = useCallback(
    async (
      api: VercelAPIClient,
      detail: string,
      validated: {
        user: Awaited<ReturnType<VercelAPIClient['getUser']>>;
        teams: Awaited<ReturnType<VercelAPIClient['listTeams']>>;
      },
      generation: number,
    ) => {
      const { user, teams } = validated;
      await selectionWriteRef.current;
      const savedTeam = await tokenStore.load(
        TokenStoreKeys.selectedTeamId,
      );
      const selectedTeamId =
        teams.some((team) => team.id === savedTeam)
          ? (savedTeam as TeamID)
          : (teams[0]?.id ?? null);
      if (generation !== generationRef.current) {
        throw new Error('Connection attempt was superseded.');
      }
      const list = await api.listProjects(selectedTeamId);
      if (generation !== generationRef.current) {
        throw new Error('Connection attempt was superseded.');
      }
      await projectSnapshots.save(selectedTeamId, list);
      if (generation !== generationRef.current) {
        throw new Error('Connection attempt was superseded.');
      }
      selectedTeamIdRef.current = selectedTeamId;
      setConnection({
        status: 'connected',
        user,
        teams,
        selectedTeamId,
        errorMessage: null,
      });
      await appendActivity(
        activity('connect', 'Connected to Vercel', detail, 'success'),
      );
      setProjects(list);
      setProjectsFromCache(false);
      setProjectsCachedAt(new Date().toISOString());
      await appendActivity(
        activity(
          'refresh_projects',
          'Loaded projects',
          `${list.length} project(s) (list without N+1 deploy fan-out)`,
          'success',
        ),
      );
      const savedProject = await tokenStore.load(
        TokenStoreKeys.selectedProjectId,
      );
      if (savedProject && list.some((p) => p.id === savedProject)) {
        const pid = savedProject as ProjectID;
        selectedProjectIdRef.current = pid;
        setSelectedProjectId(pid);
        try {
          const deploys = await api.listDeployments(pid, selectedTeamId, 30);
          if (generation !== generationRef.current) return;
          deploymentsProjectIdRef.current = pid;
          deploymentsRef.current = deploys;
          setDeployments(deploys);
        } catch {
          // Site is selected; deploys can refresh from the Deploys tab.
        }
      } else if (savedProject) {
        await tokenStore.delete(TokenStoreKeys.selectedProjectId);
      }
    },
    [appendActivity],
  );

  const connectWithToken = useCallback(
    async (token: string): Promise<ConnectionAttemptResult> => {
      if (isDemoMode) {
        return {
          status: 'rejected',
          message: 'Demo mode is on. Live Vercel is disabled.',
        };
      }
      const candidateToken = token.trim();
      const previousCredential = await loadStoredCredentialRecord(tokenStore);
      const previousConnection = connection;
      const previousApi = apiRef.current;
      let persistedCandidate: Awaited<ReturnType<typeof persistAccessToken>> | null = null;
      const generation = invalidateWork();
      setBusyKey('connect');
      setLastError(null);
      setConnection((c) => ({ ...c, status: 'connecting', errorMessage: null }));
      try {
        if (!candidateToken) throw new Error('Personal access token is required.');
        const candidateApi = new VercelAPIClientImpl({
          tokenProvider: async () => candidateToken,
        });
        const user = await candidateApi.getUser();
        const teams = await candidateApi.listTeams();
        if (generation !== generationRef.current) {
          return { status: 'rejected', message: 'Connection attempt was superseded.' };
        }
        await persistSelection(async () => {
          persistedCandidate = await persistAccessToken(tokenStore, candidateToken, {
            source: 'pat',
          });
        });
        apiRef.current = candidateApi;
        setTokenSource('pat');
        setHasRefreshToken(false);
        await finishConnect(
          candidateApi,
          'Signed in with personal access token',
          { user, teams },
          generation,
        );
        return { status: 'connected', source: 'pat' };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (persistedCandidate) {
          await restoreCredentialIfCurrent(
            tokenStore,
            persistedCandidate,
            previousCredential,
          );
        }
        if (generation === generationRef.current) {
          apiRef.current = previousApi;
          setTokenSource(previousCredential.tokenSource);
          setHasRefreshToken(
            previousCredential.tokenSource === 'oauth' &&
              previousCredential.refreshToken != null,
          );
          setLastError(msg);
          setConnection({
            ...previousConnection,
            status: previousConnection.user ? 'connected' : 'error',
            errorMessage: msg,
          });
          await appendActivity(
            activity('connect', 'Connect failed', 'credential_rejected', 'failure'),
          );
        }
        return { status: 'rejected', message: msg };
      } finally {
        if (generation === generationRef.current) setBusyKey(null);
      }
    },
    [appendActivity, connection, finishConnect, invalidateWork, persistSelection],
  );

  const connectWithOAuth = useCallback(async (): Promise<ConnectionAttemptResult> => {
    if (isDemoMode) {
      return {
        status: 'rejected',
        message: 'Demo mode is on. Live Vercel is disabled.',
      };
    }
    if (!oauthConfig) {
      throw new Error(
        'OAuth not configured. Set EXPO_PUBLIC_VERCEL_CLIENT_ID and the matching redirect URI in the Vercel app.',
      );
    }
    const previousCredential = await loadStoredCredentialRecord(tokenStore);
    const generation = invalidateWork();
    const previousConnection = connection;
    const previousApi = apiRef.current;
    let persistedCandidate: Awaited<ReturnType<typeof persistAccessToken>> | null = null;
    setBusyKey('connect');
    setLastError(null);
    setConnection((c) => ({ ...c, status: 'connecting', errorMessage: null }));
    try {
      const tokens = await startVercelOAuth(oauthConfig);
      const candidateApi = new VercelAPIClientImpl({
        tokenProvider: async () => tokens.accessToken,
      });
      const user = await candidateApi.getUser();
      const teams = await candidateApi.listTeams();
      if (generation !== generationRef.current) {
        return { status: 'rejected', message: 'Connection attempt was superseded.' };
      }
      await persistSelection(async () => {
        persistedCandidate = await persistAccessToken(tokenStore, tokens.accessToken, {
          source: 'oauth',
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        });
      });
      apiRef.current = new VercelAPIClientImpl({
        tokenProvider: () => tokenProvider(),
      });
      setTokenSource('oauth');
      setHasRefreshToken(tokens.refreshToken != null);
      await finishConnect(
        candidateApi,
        'Signed in with Vercel OAuth (PKCE)',
        { user, teams },
        generation,
      );
      return { status: 'connected', source: 'oauth' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (persistedCandidate) {
        await restoreCredentialIfCurrent(
          tokenStore,
          persistedCandidate,
          previousCredential,
        );
      }
      if (generation === generationRef.current) {
        apiRef.current = previousApi;
        setTokenSource(previousCredential.tokenSource);
        setHasRefreshToken(
          previousCredential.tokenSource === 'oauth' &&
            previousCredential.refreshToken != null,
        );
        setLastError(msg);
        setConnection({
          ...previousConnection,
          status: previousConnection.user ? 'connected' : 'error',
          errorMessage: msg,
        });
        await appendActivity(
          activity('connect', 'OAuth failed', 'oauth_rejected', 'failure'),
        );
      }
      return { status: 'rejected', message: msg };
    } finally {
      if (generation === generationRef.current) setBusyKey(null);
    }
  }, [appendActivity, connection, finishConnect, invalidateWork, persistSelection]);

  const eraseLocalData = useCallback(async () => {
    invalidateWork();
    await persistSelection(async () => {
      await clearAccessToken(tokenStore);
      await tokenStore.delete(TokenStoreKeys.selectedTeamId);
      await tokenStore.delete(TokenStoreKeys.selectedProjectId);
    });
    await Promise.all([
      activityStore.clear(),
      projectSnapshots.clearAll(),
    ]);
    apiRef.current = null;
    selectedTeamIdRef.current = null;
    selectedProjectIdRef.current = null;
    deploymentsProjectIdRef.current = null;
    deploymentsRef.current = [];
    setConnection(emptyConnection());
    setProjects([]);
    setSelectedProjectId(null);
    setDeployments([]);
    setSelectedDeployment(null);
    ops.resetAll();
    setPollingDeploymentId(null);
    setProjectsCachedAt(null);
    setProjectsFromCache(false);
    setRecentActivity([]);
    recentActivityRef.current = [];
    setTokenSource(null);
    setHasRefreshToken(false);
    setBusyKey(null);
    setConfirmPlanOpen(false);
    setPendingPlanTitle(null);
  }, [activityStore, invalidateWork, ops, persistSelection]);

  const disconnect = useCallback(async () => {
    await eraseLocalData();
  }, [eraseLocalData]);

  const refreshProjects = useCallback(async () => {
    const scope = currentScope();
    setBusyKey('refresh-projects');
    setLastError(null);
    try {
      const api = await ensureApi();
      const list = await api.listProjects(scope.teamId);
      if (!selectionScopeIsCurrent(scope, currentScope())) return;
      setProjects(list);
      setProjectsFromCache(false);
      setProjectsCachedAt(new Date().toISOString());
      await projectSnapshots.save(scope.teamId, list);
      await appendActivity(
        activity(
          'refresh_projects',
          'Refreshed projects',
          `${list.length} project(s)`,
          'success',
        ),
      );
    } catch (e) {
      if (!selectionScopeIsCurrent(scope, currentScope())) return;
      const msg = e instanceof Error ? e.message : String(e);
      setLastError(msg);
      await appendActivity(
        activity('refresh_projects', 'Refresh failed', msg, 'failure'),
      );
    } finally {
      if (selectionScopeIsCurrent(scope, currentScope())) setBusyKey(null);
    }
  }, [appendActivity, currentScope, ensureApi]);

  const selectTeam = useCallback(
    async (teamId: TeamID | null) => {
      const generation = invalidateWork();
      selectedTeamIdRef.current = teamId;
      selectedProjectIdRef.current = null;
      deploymentsProjectIdRef.current = null;
      deploymentsRef.current = [];
      setConnection((c) => ({ ...c, selectedTeamId: teamId }));
      setSelectedProjectId(null);
      setDeployments([]);
      setSelectedDeployment(null);
      await persistSelection(async () => {
        if (teamId) {
          await tokenStore.save(TokenStoreKeys.selectedTeamId, teamId);
        } else {
          await tokenStore.delete(TokenStoreKeys.selectedTeamId);
        }
        await tokenStore.delete(TokenStoreKeys.selectedProjectId);
      });
      if (generation !== generationRef.current) return;
      setBusyKey('refresh-projects');
      try {
        const api = await ensureApi();
        const list = await api.listProjects(teamId);
        if (generation !== generationRef.current) return;
        setProjects(list);
        setProjectsFromCache(false);
        setProjectsCachedAt(new Date().toISOString());
        await projectSnapshots.save(teamId, list);
      } catch (e) {
        if (generation === generationRef.current) {
          setLastError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (generation === generationRef.current) setBusyKey(null);
      }
    },
    [ensureApi, invalidateWork, persistSelection],
  );

  const loadDeployments = useCallback(
    async (projectId: ProjectID) => {
      const scope = currentScope();
      if (scope.projectId !== projectId) return;
      setBusyKey('refresh-deploys');
      setLastError(null);
      try {
        const api = await ensureApi();
        const list = await api.listDeployments(
          projectId,
          scope.teamId,
          30,
        );
        if (!selectionScopeIsCurrent(scope, currentScope())) return;
        deploymentsProjectIdRef.current = projectId;
        deploymentsRef.current = list;
        setDeployments(list);
        const summarized = summarizeDeployments(list);
        const attention = computeAttention({
          production: summarized.production,
          latest: summarized.latest,
          lastSuccess: summarized.lastSuccess,
          latestFailed: summarized.latestFailed,
        });
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  latestDeployment: summarized.latest ?? p.latestDeployment,
                  lastSuccessfulDeployment:
                    summarized.lastSuccess ?? p.lastSuccessfulDeployment,
                  latestFailedDeployment: summarized.latestFailed,
                  needsAttention: attention.needsAttention,
                  attentionReason: attention.attentionReason,
                }
              : p,
          ),
        );
        await appendActivity(
          activity(
            'load_deployments',
            'Loaded deployments',
            `${list.length} deployment(s)`,
            'success',
            { projectId },
          ),
        );
      } catch (e) {
        if (!selectionScopeIsCurrent(scope, currentScope())) return;
        const msg = e instanceof Error ? e.message : String(e);
        setLastError(msg);
        await appendActivity(
          activity('load_deployments', 'Load deployments failed', msg, 'failure', {
            projectId,
          }),
        );
      } finally {
        if (selectionScopeIsCurrent(scope, currentScope())) setBusyKey(null);
      }
    },
    [appendActivity, currentScope, ensureApi],
  );

  const selectProject = useCallback(
    async (projectId: ProjectID | null) => {
      const generation = invalidateWork();
      selectedProjectIdRef.current = projectId;
      deploymentsProjectIdRef.current = null;
      deploymentsRef.current = [];
      setSelectedProjectId(projectId);
      setDeployments([]);
      setSelectedDeployment(null);
      ops.resetForProjectChange();
      await persistSelection(async () => {
        if (projectId) {
          await tokenStore.save(
            TokenStoreKeys.selectedProjectId,
            projectId,
          );
        } else {
          await tokenStore.delete(TokenStoreKeys.selectedProjectId);
        }
      });
      if (generation !== generationRef.current) return;
      if (projectId) {
        await loadDeployments(projectId);
      } else {
        setDeployments([]);
      }
    },
    [invalidateWork, loadDeployments, ops, persistSelection],
  );

  const selectDeployment = useCallback(
    async (id: DeploymentID | null) => {
      if (!id) {
        invalidateWork();
        setSelectedDeployment(null);
        ops.resetForDeploymentChange();
        return;
      }
      if (!deploymentCanBeSelected(
        id,
        selectedProjectIdRef.current,
        deploymentsProjectIdRef.current,
        deploymentsRef.current,
      )) {
        setLastError('Deployment does not belong to the selected project.');
        setSelectedDeployment(null);
        return;
      }
      const listed = deploymentsRef.current.find((row) => row.id === id);
      if (listed) {
        setSelectedDeployment(listed);
        ops.clearFunctions();
      }
      invalidateWork();
      const scope = currentScope();
      setBusyKey('deployment');
      setLastError(null);
      try {
        const api = await ensureApi();
        const d = await api.getDeployment(id, scope.teamId);
        if (!selectionScopeIsCurrent(scope, currentScope())) return;
        if (!deploymentCanBeSelected(
          id,
          scope.projectId,
          deploymentsProjectIdRef.current,
          deploymentsRef.current,
        )) return;
        setSelectedDeployment(d);
        ops.clearFunctions();
      } catch (e) {
        if (selectionScopeIsCurrent(scope, currentScope())) {
          setLastError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (selectionScopeIsCurrent(scope, currentScope())) setBusyKey(null);
      }
    },
    [currentScope, ensureApi, invalidateWork, ops],
  );

  const pollUntilReady = useCallback(
    async (deploymentId: DeploymentID, projectId: ProjectID) => {
      const token = ++pollCancelRef.current;
      setPollingDeploymentId(deploymentId);
      setPollProgress(0);
      setPollAttempt(0);
      await appendActivity(
        activity(
          'deployment_poll',
          'Polling deployment state',
          `Waiting for Vercel terminal state on ${deploymentId} (READY only means success)`,
          'info',
          { projectId, deploymentId },
        ),
      );
      try {
        const api = await ensureApi();
        let attempt = 0;
        const result = await pollDeploymentUntilTerminal({
          getState: async () => {
            attempt += 1;
            setPollAttempt(attempt);
            setPollProgress(Math.min(1, attempt / pollMaxAttempts));
            const d = await api.getDeployment(
              deploymentId,
              connection.selectedTeamId,
            );
            return d.state;
          },
          intervalMs: 2500,
          maxAttempts: pollMaxAttempts,
        });
        if (token !== pollCancelRef.current) return;
        setPollProgress(1);
        await appendActivity(
          activity(
            'deployment_poll',
            result.isReady
              ? 'Deployment READY'
              : result.isFailed
                ? `Deployment ${result.finalState}`
                : 'Deployment poll finished',
            result.summary,
            result.isReady ? 'success' : result.isFailed ? 'failure' : 'info',
            { projectId, deploymentId },
          ),
        );
        if (selectedProjectIdRef.current === projectId) {
          await loadDeployments(projectId);
          try {
            const d = await api.getDeployment(
              deploymentId,
              connection.selectedTeamId,
            );
            if (
              token === pollCancelRef.current &&
              selectedProjectIdRef.current === projectId &&
              deploymentsProjectIdRef.current === projectId
            ) {
              setSelectedDeployment(d);
            }
          } catch {}
        }
      } catch (e) {
        if (token !== pollCancelRef.current) return;
        await appendActivity(
          activity(
            'deployment_poll',
            'Deployment poll failed',
            e instanceof Error ? e.message : String(e),
            'failure',
            { projectId, deploymentId },
          ),
        );
      } finally {
        if (token === pollCancelRef.current) {
          setPollingDeploymentId(null);
          setPollProgress(null);
          setPollAttempt(0);
        }
      }
    },
    [
      appendActivity,
      connection.selectedTeamId,
      ensureApi,
      loadDeployments,
    ],
  );

  const requestRedeploy = useCallback(
    async (opts?: {
      target?: 'production' | 'preview' | null;
      mode?: 'redeploy' | 'promote' | 'rollback';
    }) => {
      if (!selectedDeployment || !selectedProjectId) return;
      if (!deploymentCanBeSelected(
        selectedDeployment.id,
        selectedProjectId,
        deploymentsProjectIdRef.current,
        deploymentsRef.current,
      )) {
        setLastError('Source deployment does not belong to the selected project.');
        return;
      }
      const mode = opts?.mode ?? 'redeploy';
      const policy = ConfirmationPolicy.default;
      const action =
        mode === 'promote'
          ? policy.descriptor({
              type: 'promoteToProduction',
              deploymentId: selectedDeployment.id,
              projectId: selectedProjectId,
              teamId: connection.selectedTeamId,
            })
          : mode === 'rollback'
            ? policy.descriptor({
                type: 'rollbackProduction',
                deploymentId: selectedDeployment.id,
                projectId: selectedProjectId,
                teamId: connection.selectedTeamId,
              })
            : policy.descriptor({
                type: 'redeploy',
                deploymentId: selectedDeployment.id,
                projectId: selectedProjectId,
                teamId: connection.selectedTeamId,
                target: (() => {
                  const t = opts?.target ?? selectedDeployment.target;
                  return t === 'production' || t === 'preview' ? t : null;
                })(),
              });

      const confirmation = mutationConfirmationFor(action.action as Extract<
        typeof action.action,
        { type: 'redeploy' | 'promoteToProduction' | 'rollbackProduction' }
      >);
      const confirmationGeneration = generationRef.current;

      const plan = newActionPlan(action.title, action.summary, [action]);
      setPendingPlanTitle(plan.title);
      setConfirmPlanOpen(true);

      Alert.alert(
        action.title,
        `${action.summary}\n\n${formatMutationConfirmation(confirmation)}\n\nThis requires hard confirmation. Taktung will not claim success until Vercel accepts the deployment request.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setConfirmPlanOpen(false);
              setPendingPlanTitle(null);
            },
          },
          {
            text: 'Confirm',
            style: mode === 'rollback' ? 'destructive' : 'default',
            onPress: () => {
              void (async () => {
                setBusyKey('mutator');
                setLastError(null);
                try {
                  if (
                    confirmationGeneration !== generationRef.current ||
                    selectedProjectIdRef.current !== confirmation.projectId ||
                    !deploymentCanBeSelected(
                      confirmation.sourceDeploymentId,
                      selectedProjectIdRef.current,
                      deploymentsProjectIdRef.current,
                      deploymentsRef.current,
                    )
                  ) {
                    throw new Error(
                      'Selection changed after confirmation was requested. Mutation canceled.',
                    );
                  }
                  const api = await ensureApi();
                  const result: ExecutePlanResult = await executeApprovedPlan(
                    plan,
                    api,
                    {
                      hardConfirmAcknowledged: true,
                      confirmedMutation: confirmation,
                    },
                  );
                  if (!result.ok) {
                    const msg =
                      result.blockedReason ??
                      result.results.map((r) => r.message).join('; ');
                    setLastError(msg);
                    await appendActivity(
                      activity(
                        mode === 'promote'
                          ? 'promote'
                          : mode === 'rollback'
                            ? 'rollback'
                            : 'redeploy',
                        `${action.title} failed`,
                        msg,
                        'failure',
                        {
                          projectId: confirmation.projectId,
                          deploymentId: confirmation.sourceDeploymentId,
                        },
                      ),
                    );
                  } else {
                    const created = result.results[0]?.data as
                      | VercelDeploymentSummary
                      | undefined;
                    await appendActivity(
                      activity(
                        mode === 'promote'
                          ? 'promote'
                          : mode === 'rollback'
                            ? 'rollback'
                            : 'redeploy',
                        `${action.title} accepted`,
                        created
                          ? `New deployment ${created.id} state=${created.state} (polling until READY — not claimed yet)`
                          : 'Vercel accepted the request',
                        'info',
                        {
                          projectId: confirmation.projectId,
                          deploymentId: created?.id ?? confirmation.sourceDeploymentId,
                        },
                      ),
                    );
                    await loadDeployments(confirmation.projectId);
                    const toPoll = created?.id ?? null;
                    if (toPoll) {
                      void pollUntilReady(toPoll, confirmation.projectId);
                    }
                  }
                } catch (e) {
                  setLastError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusyKey(null);
                  setConfirmPlanOpen(false);
                  setPendingPlanTitle(null);
                }
              })();
            },
          },
        ],
      );
    },
    [
      appendActivity,
      connection.selectedTeamId,
      ensureApi,
      loadDeployments,
      pollUntilReady,
      selectedDeployment,
      selectedProjectId,
    ],
  );

  const clearActivity = useCallback(async () => {
    await activityStore.clear();
    recentActivityRef.current = [];
    setRecentActivity([]);
  }, [activityStore]);

  // Rehydrate
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isDemoMode) {
          const now = Date.now();
          const demoProjects = buildDemoProjects(now);
          const deploys = buildDemoDeployments(DEMO_PROJECT_ID.portfolio, now);
          const items = buildDemoActivity(now);
          selectedTeamIdRef.current = DEMO_TEAM_ID;
          selectedProjectIdRef.current = DEMO_PROJECT_ID.portfolio;
          deploymentsProjectIdRef.current = DEMO_PROJECT_ID.portfolio;
          deploymentsRef.current = deploys;
          apiRef.current = new DemoVercelAPIClient();
          recentActivityRef.current = items;
          setRecentActivity(items);
          setConnection(buildDemoConnection());
          setProjects(demoProjects);
          setSelectedProjectId(DEMO_PROJECT_ID.portfolio);
          setDeployments(deploys);
          setProjectsFromCache(false);
          setProjectsCachedAt(new Date(now).toISOString());
          setTokenSource('pat');
          setHasRefreshToken(false);
          try {
            const available = await probeOnDeviceAvailable();
            if (!cancelled) setOnDeviceAvailable(available);
          } catch {
            if (!cancelled) setOnDeviceAvailable(false);
          }
          return;
        }
        const items = await activityStore.load();
        if (!cancelled) {
          recentActivityRef.current = items;
          setRecentActivity(items);
        }
        try {
          const available = await probeOnDeviceAvailable();
          if (!cancelled) setOnDeviceAvailable(available);
        } catch {
          if (!cancelled) setOnDeviceAvailable(false);
        }
        const token = await tokenProvider();
        if (token && !cancelled) {
          const source = (await loadTokenSource(tokenStore)) ?? 'pat';
          const refreshToken = await tokenStore.load(
            TokenStoreKeys.refreshToken,
          );
          const generation = generationRef.current;
          const api = new VercelAPIClientImpl({
            tokenProvider: () => tokenProvider(),
          });
          const user = await api.getUser();
          const teams = await api.listTeams();
          if (!cancelled && generation === generationRef.current) {
            apiRef.current = api;
            setTokenSource(source);
            setHasRefreshToken(source === 'oauth' && refreshToken != null);
            await finishConnect(
              api,
              source === 'oauth'
                ? 'Restored Vercel OAuth session'
                : 'Restored personal access token session',
              { user, teams },
              generation,
            );
          }
        }
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e);
          setLastError(message);
          setConnection((current) => ({
            ...current,
            status: 'error',
            errorMessage: message,
          }));
        }
      } finally {
        if (!cancelled) setIsRehydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityStore, finishConnect]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const buildCurrentOpsContext = useCallback(
    () =>
      buildBoundedOpsContext({
        projectName: selectedProject?.name ?? null,
        productionState: selectedProject?.productionDeployment?.state ?? null,
        needsAttention: selectedProject?.needsAttention ?? false,
        attentionReason: selectedProject?.attentionReason ?? null,
        incidentHeadline: ops.incident?.headline ?? null,
        incidentCause: ops.incident?.likelyCause ?? null,
        incidentConfidence: ops.incident?.confidence ?? null,
        envDriftCritical:
          ops.envDrift?.findings.filter((f) => f.severity === 'critical').length ??
          0,
        envDriftSummary: ops.envDrift?.summary ?? null,
        compareRisk: ops.deploymentDiff?.riskLevel ?? null,
        compareSummary: ops.deploymentDiff?.summary ?? null,
        runtimeErrorCount: ops.runtimeLogs?.errorCount ?? null,
        runtimeSummary: ops.runtimeLogs?.summary ?? null,
        domainCritical:
          ops.domainReport?.domains.filter((d) => d.severity === 'critical')
            .length ?? 0,
        domainSummary: ops.domainReport?.summary ?? null,
        polling: pollingDeploymentId != null,
        lastMutatorNote: null,
      }),
    [ops, pollingDeploymentId, selectedProject],
  );

  const ensureOnDeviceBackend = useCallback(async () => {
    if (!onDeviceBackendRef.current) {
      onDeviceBackendRef.current = createOnDeviceBackend();
    }
    return onDeviceBackendRef.current;
  }, []);

  const runOpsBrief = useCallback(async () => {
    const ctx = buildCurrentOpsContext();
    const backend = await ensureOnDeviceBackend();
    const n = await synthesizeOpsNarrativeHybrid(ctx, backend);
    setOpsNarrative(n);
    await appendActivity(
      activity('note', n.headline, formatOpsNarrative(n), 'info', {
        projectId: selectedProjectId,
      }),
    );
  }, [
    appendActivity,
    buildCurrentOpsContext,
    ensureOnDeviceBackend,
    selectedProjectId,
  ]);

  const routeSearchQuery = useCallback(
    async (query: string): Promise<OpsRouteResult> => {
      const backend = await ensureOnDeviceBackend();
      const structured =
        backend?.generateStructured != null
          ? {
              kind: backend.kind,
              generateStructured: backend.generateStructured,
            }
          : null;
      const result = await routeOpsQuery(
        query,
        buildCurrentOpsContext(),
        OPS_COMMAND_CATALOG.map((cmd) => ({
          id: cmd.id,
          label: cmd.label,
          description: cmd.example,
        })),
        structured,
      );
      const title = `Search: ${result.ok ? result.action : 'failed'}`;
      const detail = result.ok
        ? result.reason || result.action
        : 'On-device model did not return a usable check';
      await appendActivity(
        activity(
          'note',
          title,
          containsSecretLike(detail)
            ? result.ok
              ? result.action
              : 'rejected'
            : detail,
          result.ok ? 'info' : 'failure',
          { projectId: selectedProjectId },
        ),
      );
      return result;
    },
    [
      appendActivity,
      buildCurrentOpsContext,
      ensureOnDeviceBackend,
      selectedProjectId,
    ],
  );

  const value = useMemo((): AppContextValue => ({
    connection,
    projects,
    selectedProjectId,
    deployments,
    selectedDeployment,
    buildLogs: ops.buildLogs,
    envMeta: ops.envMeta,
    envDrift: ops.envDrift,
    incident: ops.incident,
    domainReport: ops.domainReport,
    deploymentDiff: ops.deploymentDiff,
    observability: ops.observability,
    firewall: ops.firewall,
    featureFlags: ops.featureFlags,
    runtimeLogs: ops.runtimeLogs,
    deploymentFunctions: ops.deploymentFunctions,
    pollingDeploymentId,
    pollProgress,
    pollAttempt,
    pollMaxAttempts,
    projectsCachedAt,
    projectsFromCache,
    opsNarrative,
    oauthConfigured: oauthConfig != null,
    tokenSource,
    hasRefreshToken,
    recentActivity,
    activeTab,
    settingsOpen,
    commandOpen,
    confirmPlanOpen,
    pendingPlanTitle,
    lastError,
    isBusy,
    busyKey,
    isRehydrating,
    onDeviceAvailable,
    setActiveTab,
    setSettingsOpen,
    setCommandOpen,
    connectWithToken,
    connectWithOAuth,
    disconnect,
    eraseLocalData,
    runOpsBrief,
    routeSearchQuery,
    selectTeam,
    refreshProjects,
    selectProject,
    loadDeployments,
    selectDeployment,
    loadBuildLogs: ops.loadBuildLogs,
    runEnvDriftCheck: ops.runEnvDriftCheck,
    runIncidentSummary: ops.runIncidentSummary,
    runDomainDiagnostics: ops.runDomainDiagnostics,
    runDeploymentCompare: ops.runDeploymentCompare,
    runObservability: ops.runObservability,
    runFirewallExplain: ops.runFirewallExplain,
    runFeatureFlags: ops.runFeatureFlags,
    runRuntimeLogQuery: ops.runRuntimeLogQuery,
    loadDeploymentFunctions: ops.loadDeploymentFunctions,
    requestRedeploy,
    clearActivity,
    selectedProject,
  }), [
    connection,
    projects,
    selectedProjectId,
    deployments,
    selectedDeployment,
    ops,
    pollingDeploymentId,
    pollProgress,
    pollAttempt,
    projectsCachedAt,
    projectsFromCache,
    opsNarrative,
    tokenSource,
    hasRefreshToken,
    recentActivity,
    activeTab,
    settingsOpen,
    commandOpen,
    confirmPlanOpen,
    pendingPlanTitle,
    lastError,
    isBusy,
    busyKey,
    isRehydrating,
    onDeviceAvailable,
    setActiveTab,
    setSettingsOpen,
    setCommandOpen,
    connectWithToken,
    connectWithOAuth,
    disconnect,
    eraseLocalData,
    runOpsBrief,
    routeSearchQuery,
    selectTeam,
    refreshProjects,
    selectProject,
    loadDeployments,
    selectDeployment,
    requestRedeploy,
    clearActivity,
    selectedProject,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
