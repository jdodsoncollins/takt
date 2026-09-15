import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useApp } from '../../shell/AppContext';
import { colors, radii, spacing } from '../../design-system/theme';
import {
  PrimaryButton,
  SectionLabel,
} from '../../design-system/GlassChrome';
import { DataText, InsightChip } from '../../design-system/ConsoleType';
import {
  OPS_COMMAND_CATALOG,
  OPS_COMMAND_SUGGESTIONS,
  rankOpsCommands,
  type OpsCommand,
  type OpsCommandId,
} from './opsCommands';
import { OPS_ROUTE_ANSWER } from '../../domain/analysis/opsRouter';
import { connectionIsConnected } from '../../domain/models/vercelModels';
import { openDeployment } from '../../shell/nav';
import { SearchResults } from './SearchResults';
import {
  resolveSearchWidgets,
  searchNeedsFetch,
  type SearchWidgetContext,
  type SearchWidgetId,
} from './searchWidgets';

/**
 * Search is a results canvas: summary + reused ops widgets.
 * Chips skip the model; typed submit is on-device LLM only.
 * Mutators are not in the catalog. Results do not switch tabs.
 */
export type CommandHandle = {
  run: (text?: string) => void;
  setQuery: (value: string) => void;
  clear: () => void;
};

const MODEL_MISS = 'On-device model did not return a usable check';

export function CommandSheet({
  hideComposer = false,
  handleRef,
}: {
  hideComposer?: boolean;
  handleRef?: MutableRefObject<CommandHandle | null>;
}) {
  const {
    connection,
    selectedProject,
    selectedDeployment,
    runIncidentSummary,
    runEnvDriftCheck,
    loadBuildLogs,
    loadDeployments,
    selectProject,
    selectDeployment,
    runDomainDiagnostics,
    runDeploymentCompare,
    runFirewallExplain,
    runFeatureFlags,
    runRuntimeLogQuery,
    runOpsBrief,
    routeSearchQuery,
    onDeviceAvailable,
  } = useApp();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [routeReason, setRouteReason] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [widgets, setWidgets] = useState<SearchWidgetId[]>([]);
  const [routing, setRouting] = useState(false);
  const [activeChipId, setActiveChipId] = useState<Exclude<
    OpsCommandId,
    'unknown'
  > | null>(null);
  const lastActionRef = useRef<{
    id: Exclude<OpsCommandId, 'unknown'>;
    raw: string;
  } | null>(null);
  const resumeAfterPick = useRef<'project' | 'deployment' | null>(null);
  const fulfillGen = useRef(0);

  useEffect(() => {
    const spoken = [routeReason, answer, status].filter(Boolean).join('. ');
    if (spoken) AccessibilityInfo.announceForAccessibility(spoken);
  }, [answer, routeReason, status]);

  useEffect(() => {
    const pending = lastActionRef.current;
    const resume = resumeAfterPick.current;
    if (!pending || !resume) return;
    if (resume === 'project' && !selectedProject) return;
    if (resume === 'deployment' && !selectedDeployment) return;
    resumeAfterPick.current = null;
    if (pending.id === 'projects' && resume === 'project') return;
    const controller = new AbortController();
    const gen = ++fulfillGen.current;
    void fulfill(pending.id, pending.raw, undefined, gen, controller.signal);
    return () => {
      controller.abort();
      fulfillGen.current += 1;
    };
    // fulfill is recreated each render; resume flag is the gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, selectedDeployment]);

  const widgetContext = () => ({
    connected: connectionIsConnected(connection),
    hasProject: selectedProject != null,
    hasDeployment: selectedDeployment != null,
  });

  const fulfill = async (
    id: Exclude<OpsCommandId, 'unknown'>,
    raw: string,
    ctxOverride?: Partial<SearchWidgetContext>,
    gen = ++fulfillGen.current,
    signal?: AbortSignal,
  ) => {
    const still = () => gen === fulfillGen.current && !signal?.aborted;
    lastActionRef.current = { id, raw };
    const resolved = resolveSearchWidgets(id, {
      ...widgetContext(),
      ...ctxOverride,
    });
    if (!still()) return;
    setWidgets(resolved);
    if (!searchNeedsFetch(id, resolved)) {
      if (!still()) return;
      if (resolved.includes('projects') && id !== 'projects') {
        setStatus('Pick a site here — results stay in Search.');
      } else if (resolved.includes('deploys') && id !== 'deploys') {
        setStatus('Pick a deployment here — results stay in Search.');
      } else if (resolved.includes('account')) {
        setStatus('Connect here, then ask again.');
      } else {
        setStatus(null);
      }
      return;
    }
    setStatus('Loading…');
    if (id === 'incident') {
      await runIncidentSummary();
    } else if (id === 'env') {
      await runEnvDriftCheck();
    } else if (id === 'domain') {
      await runDomainDiagnostics();
    } else if (id === 'compare') {
      await runDeploymentCompare();
    } else if (id === 'firewall') {
      await runFirewallExplain();
    } else if (id === 'flags') {
      await runFeatureFlags();
    } else if (id === 'runtime') {
      await runRuntimeLogQuery(raw);
    } else if (id === 'issues') {
      await runOpsBrief();
    } else if (id === 'logs') {
      await loadBuildLogs();
    } else if (id === 'deploys' && selectedProject) {
      await loadDeployments(selectedProject.id);
    }
    if (!still()) return;
    setStatus(null);
  };

  const clearResults = () => {
    lastActionRef.current = null;
    resumeAfterPick.current = null;
    setActiveChipId(null);
    setQuery('');
    setStatus(null);
    setRouteReason(null);
    setAnswer(null);
    setNextSteps([]);
    setWidgets([]);
    setRouting(false);
  };

  const runChip = (cmd: OpsCommand) => {
    if (activeChipId === cmd.id && widgets.length > 0) {
      clearResults();
      return;
    }
    setActiveChipId(cmd.id);
    setRouteReason(null);
    setAnswer(null);
    setNextSteps([]);
    void fulfill(cmd.id, cmd.example);
  };

  const runTyped = (text?: string) => {
    const raw = (text ?? query).trim();
    if (text != null) setQuery(text);
    if (!raw) {
      setStatus('Pick a suggestion or type a read-only check.');
      return;
    }
    setRouting(true);
    setRouteReason(null);
    setAnswer(null);
    setNextSteps([]);
    setWidgets([]);
    setStatus('Looking up on-device…');
    const gen = ++fulfillGen.current;
    const still = () => gen === fulfillGen.current;
    void (async () => {
      try {
        const result = await routeSearchQuery(raw);
        if (!still()) return;
        if (!result.ok) {
          setStatus(MODEL_MISS);
          return;
        }
        setRouteReason(result.reason || null);
        setNextSteps(result.nextSteps);
        if (result.action === OPS_ROUTE_ANSWER) {
          setAnswer(result.answer);
          setStatus(null);
          setWidgets([]);
          return;
        }
        setAnswer(result.answer || null);
        const action = result.action;
        const executable = OPS_COMMAND_CATALOG.some((c) => c.id === action);
        if (!executable) {
          setStatus(MODEL_MISS);
          return;
        }
        setActiveChipId(action as Exclude<OpsCommandId, 'unknown'>);
        await fulfill(action as Exclude<OpsCommandId, 'unknown'>, raw, undefined, gen);
      } catch {
        if (still()) setStatus(MODEL_MISS);
      } finally {
        if (still()) setRouting(false);
      }
    })();
  };

  useEffect(() => {
    if (handleRef) {
      handleRef.current = { run: runTyped, setQuery, clear: clearResults };
    }
    return () => {
      if (handleRef) handleRef.current = null;
    };
  });

  useEffect(() => {
    return () => {
      fulfillGen.current += 1;
    };
  }, []);

  const showingResults =
    widgets.length > 0 || !!answer || (!!status && status !== 'Loading…');

  const chips = useMemo(() => {
    if (showingResults) return OPS_COMMAND_SUGGESTIONS;
    if (query.trim().length < 2) return OPS_COMMAND_SUGGESTIONS;
    const ranked = rankOpsCommands(query);
    return ranked.length > 0 ? ranked : OPS_COMMAND_SUGGESTIONS;
  }, [query, showingResults]);

  if (!onDeviceAvailable) return null;

  return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
          <ScrollView
            contentContainerStyle={styles.sheetBody}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
          >
            <SectionLabel>Suggestions</SectionLabel>
            <View style={styles.chips}>
              {chips.map((s) => (
                <InsightChip
                  key={s.id}
                  label={s.label}
                  selected={activeChipId === s.id}
                  onPress={() => runChip(s)}
                />
              ))}
            </View>
            {showingResults ? (
              <PrimaryButton
                title="Clear results"
                variant="ghost"
                onPress={clearResults}
                accessibilityHint="Shows all suggestions again"
              />
            ) : null}
            {hideComposer ? (
              routing ? <DataText>Looking up on-device…</DataText> : null
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={() => runTyped()}
                  placeholder="Ask Taktung…"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Operations question"
                  accessibilityHint="On-device model returns a summary and widgets in Search"
                  returnKeyType="search"
                  editable={!routing}
                />
                <PrimaryButton
                  title={routing ? 'Looking up…' : 'Ask'}
                  onPress={() => runTyped()}
                  disabled={routing}
                />
              </>
            )}
            <SearchResults
              widgets={widgets}
              reason={routeReason}
              answer={answer}
              nextSteps={nextSteps}
              status={routing ? null : status}
              onProjectPicked={(projectId) => {
                resumeAfterPick.current = 'project';
                void selectProject(projectId);
              }}
              onDeploymentPicked={(deployId) => {
                if (lastActionRef.current?.id === 'deploys') {
                  void selectDeployment(deployId);
                  openDeployment(deployId);
                  return;
                }
                resumeAfterPick.current = 'deployment';
                void selectDeployment(deployId);
              }}
              openDeployOnSelect={lastActionRef.current?.id === 'deploys'}
            />
          </ScrollView>
      </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  sheetBody: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceMuted,
  },
});
