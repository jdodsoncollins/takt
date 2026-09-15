import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useApp } from '../../shell/AppContext';
import { openDeploymentFunctions, openDeploymentHosts } from '../../shell/nav';
import {
  colors,
  radii,
  spacing,
  touch,
  typography,
} from '../../design-system/theme';
import { ContentCard, PrimaryButton, SectionLabel } from '../../design-system/GlassChrome';
import { DeploymentPreviewThumb } from '../../design-system/DeploymentPreviewThumb';
import { useDeploymentPreview } from './useDeploymentPreview';
import {
  DataText,
  GroupedList,
  GroupedRow,
  StateWord,
} from '../../design-system/ConsoleType';
import { SymbolIcon } from '../../design-system/SymbolIcon';
import { AccessibilityIDs } from '../../support/accessibilityIDs';
import { resolveSheetDeployment } from '../../domain/models/selectionSafety';
import {
  isFailedState,
  isSuccessState,
} from '../../domain/analysis/projectHealth';
import {
  commitBody,
  deploymentProvenanceLine,
  deploymentRefLine,
  deploymentTitle,
} from '../../domain/analysis/deploymentList';
import {
  classifyDeploymentHosts,
  hostsSummary,
} from '../../domain/analysis/deploymentHosts';
import {
  BuildLogsSection,
  CompareSection,
  IncidentSection,
  RuntimeLogsSection,
} from '../ops/OpsSections';

type DetailPane = 'logs' | 'diagnose' | 'compare' | 'errors';

const DETAIL_PANES: {
  key: DetailPane;
  label: string;
  a11y: string;
  busy: string;
  testID: string;
}[] = [
  {
    key: 'logs',
    label: 'Logs',
    a11y: 'Build logs',
    busy: 'logs',
    testID: AccessibilityIDs.detailPaneLogs,
  },
  {
    key: 'diagnose',
    label: 'Diagnose',
    a11y: 'Diagnose',
    busy: 'incident',
    testID: AccessibilityIDs.detailPaneDiagnose,
  },
  {
    key: 'compare',
    label: 'Compare',
    a11y: 'Compare',
    busy: 'compare',
    testID: AccessibilityIDs.detailPaneCompare,
  },
  {
    key: 'errors',
    label: 'Errors',
    a11y: 'Errors since this deploy',
    busy: 'runtime-logs',
    testID: AccessibilityIDs.detailPaneErrors,
  },
];

export function DeploymentDetailSheet({
  deploymentId: routeDeploymentId,
  onClose,
}: {
  deploymentId?: string;
  visible?: boolean;
  asScreen?: boolean;
  onClose: () => void;
}) {
  const {
    selectedProject,
    selectedDeployment,
    deployments,
    buildLogs,
    incident,
    deploymentDiff,
    busyKey,
    lastError,
    loadBuildLogs,
    runIncidentSummary,
    runDeploymentCompare,
    runRuntimeLogQuery,
    runtimeLogs,
    requestRedeploy,
    connection,
  } = useApp();
  const insets = useSafeAreaInsets();
  const mutatorBusy = busyKey === 'mutator';
  const deployment = resolveSheetDeployment(
    routeDeploymentId,
    selectedDeployment,
    deployments,
  );
  const previewUrl = useDeploymentPreview(
    deployment?.url,
    deployment?.state ?? 'UNKNOWN',
  );
  const [pane, setPane] = useState<DetailPane | null>(null);
  const [sheetH, setSheetH] = useState(0);
  const deploymentId = deployment?.id ?? null;

  useEffect(() => {
    setPane(null);
  }, [deploymentId]);

  if (!selectedProject || !deployment) {
    const loading = busyKey === 'deployment';
    return (
      <View style={styles.screen}>
        <Text style={styles.empty}>
          {loading
            ? 'Loading this deployment…'
            : lastError ?? 'Select a deployment from the list.'}
        </Text>
      </View>
    );
  }

  const title = deploymentTitle(deployment);
  const body = commitBody(deployment.meta.githubCommitMessage);
  const provenance = deploymentProvenanceLine(deployment);
  const teamSlug =
    connection.teams.find((t) => t.id === connection.selectedTeamId)?.slug ??
    null;
  const hosts = classifyDeploymentHosts(deployment.aliases ?? [], {
    projectName: selectedProject.name,
    teamSlug,
    commitSha: deployment.meta.githubCommitSha,
    deploymentId: deployment.id,
    branch: deployment.meta.githubCommitRef,
    productionDomains: [selectedProject.primaryDomain],
    deploymentUrl: deployment.url,
  });

  const selectPane = (next: DetailPane) => {
    if (pane === next) {
      setPane(null);
      return;
    }
    void Haptics.selectionAsync();
    setPane(next);
    if (next === 'logs') void loadBuildLogs();
    else if (next === 'diagnose') void runIncidentSummary();
    else if (next === 'compare') void runDeploymentCompare();
    else void runRuntimeLogQuery('errors since deploy on this deploy');
  };

  const showFace = pane == null;

  return (
    <View
      style={styles.screen}
      onLayout={(e) => {
        const next = Math.round(e.nativeEvent.layout.height);
        if (next > 0 && next !== sheetH) setSheetH(next);
      }}
    >
      <ScrollView
        style={sheetH > 0 ? { height: sheetH } : styles.scroll}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: spacing.xxxl + insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustsScrollIndicatorInsets={false}
        alwaysBounceVertical
        nestedScrollEnabled
      >
        <View style={styles.row}>
          <StateWord label={deployment.state} />
          <DataText>{deployment.target ?? 'no target'}</DataText>
        </View>
        <Text style={styles.title} numberOfLines={showFace ? undefined : 2}>
          {title}
        </Text>
        {showFace ? (
          <>
            {body ? <DataText>{body}</DataText> : null}
            <DataText>{deploymentRefLine(deployment)}</DataText>
            {provenance ? <DataText>{provenance}</DataText> : null}
            {deployment.url ? (
              <>
                <DeploymentPreviewThumb imageUrl={previewUrl} variant="detail" />
                <PrimaryButton
                  title="Open deployment URL"
                  variant="ghost"
                  onPress={() => {
                    const url = deployment.url;
                    if (url) {
                      void Linking.openURL(
                        url.startsWith('http') ? url : `https://${url}`,
                      );
                    }
                  }}
                />
              </>
            ) : null}
            <View>
              <SectionLabel>Inspect</SectionLabel>
              <GroupedList>
                <GroupedRow
                  onPress={() => openDeploymentHosts(deployment.id)}
                  accessibilityLabel={`Hosts, ${hostsSummary(hosts)}`}
                  accessibilityHint="Opens assigned hosts for this deployment"
                >
                  <View
                    style={styles.inspectBody}
                    testID={AccessibilityIDs.inspectHosts}
                  >
                    <Text style={styles.inspectTitle}>Hosts</Text>
                    <DataText numberOfLines={1}>{hostsSummary(hosts)}</DataText>
                  </View>
                  <SymbolIcon
                    name="chevron.right"
                    size={14}
                    color={colors.textTertiary}
                  />
                </GroupedRow>
                <GroupedRow
                  last
                  onPress={() => openDeploymentFunctions(deployment.id)}
                  accessibilityLabel="Functions, this deploy"
                  accessibilityHint="Opens function inventory for this deployment"
                >
                  <View
                    style={styles.inspectBody}
                    testID={AccessibilityIDs.inspectFunctions}
                  >
                    <Text style={styles.inspectTitle}>Functions</Text>
                    <DataText numberOfLines={1}>This deploy</DataText>
                  </View>
                  <SymbolIcon
                    name="chevron.right"
                    size={14}
                    color={colors.textTertiary}
                  />
                </GroupedRow>
              </GroupedList>
            </View>
          </>
        ) : null}

        <View style={styles.tablist} accessibilityRole="tablist">
          {DETAIL_PANES.map((tab, i) => {
            const selected = pane === tab.key;
            const busy = busyKey === tab.busy && selected;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityLabel={tab.a11y}
                accessibilityState={{ selected, busy }}
                testID={tab.testID}
                onPress={() => selectPane(tab.key)}
                style={[
                  styles.tab,
                  i > 0 && styles.tabDivider,
                  selected && styles.tabOn,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <Text
                    style={[styles.tabLabel, selected && styles.tabLabelOn]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {pane == null && isFailedState(deployment.state) ? (
          <Text style={styles.caption}>
            This deploy failed. Diagnose for a local summary.
          </Text>
        ) : null}
        {pane === 'diagnose' ? (
          busyKey === 'incident' && incident == null ? (
            <ContentCard>
              <Text style={styles.caption}>Diagnosing…</Text>
            </ContentCard>
          ) : (
            <IncidentSection incident={incident} />
          )
        ) : null}
        {pane === 'compare' ? (
          busyKey === 'compare' && deploymentDiff == null ? (
            <ContentCard>
              <Text style={styles.caption}>Comparing…</Text>
            </ContentCard>
          ) : (
            <CompareSection diff={deploymentDiff} />
          )
        ) : null}
        {pane === 'logs' ? (
          busyKey === 'logs' && buildLogs.length === 0 ? (
            <ContentCard>
              <Text style={styles.caption}>Loading build logs…</Text>
            </ContentCard>
          ) : (
            <BuildLogsSection lines={buildLogs} />
          )
        ) : null}
        {pane === 'errors' ? (
          busyKey === 'runtime-logs' && runtimeLogs == null ? (
            <ContentCard>
              <Text style={styles.caption}>Loading errors…</Text>
            </ContentCard>
          ) : (
            <RuntimeLogsSection report={runtimeLogs} />
          )
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton
            title="Redeploy"
            onPress={() => void requestRedeploy({ mode: 'redeploy' })}
            disabled={mutatorBusy}
            testID={AccessibilityIDs.redeployButton}
          />
          {deployment.target !== 'production' &&
          isSuccessState(deployment.state) ? (
            <PrimaryButton
              title="Promote"
              onPress={() => void requestRedeploy({ mode: 'promote' })}
              disabled={mutatorBusy}
              variant="danger"
              accessibilityHint={`Requires confirmation to promote source ${deployment.id} in project ${selectedProject.id} to production`}
            />
          ) : null}
          {isSuccessState(deployment.state) ? (
            <PrimaryButton
              title="Rollback"
              onPress={() => void requestRedeploy({ mode: 'rollback' })}
              disabled={mutatorBusy}
              variant="danger"
            />
          ) : null}
        </View>
        {deployment.isRollbackCandidate ? (
          <DataText>Vercel lists this as a rollback candidate.</DataText>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: colors.backgroundElevated,
  },
  scroll: { flex: 1, minHeight: 0 },
  body: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    columnGap: spacing.md,
  },
  title: { ...typography.title3 },
  caption: { ...typography.caption },
  empty: {
    ...typography.caption,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tablist: {
    flexDirection: 'row',
    borderRadius: radii.plate,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    minHeight: touch.min,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touch.min,
    paddingHorizontal: spacing.xs,
  },
  tabDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  tabOn: { backgroundColor: colors.accentSoft },
  tabLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabLabelOn: { color: colors.accent },
  pane: { marginTop: spacing.md, gap: spacing.md },
  inspectBody: { flex: 1, minWidth: 0, gap: 2 },
  inspectTitle: { ...typography.headline },
});
