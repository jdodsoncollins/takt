import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { openDeployment } from '../../shell/nav';
import {
  AccessibilityInfo,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useApp } from '../../shell/AppContext';
import {
  colors,
  layout,
  radii,
  spacing,
  typography,
} from '../../design-system/theme';
import {
  ContentCard,
  FilterChip,
  ProgressBar,
  SectionLabel,
} from '../../design-system/GlassChrome';
import { DataText } from '../../design-system/ConsoleType';
import { AccessibilityIDs } from '../../support/accessibilityIDs';
import type { DeploymentID } from '../../domain/models/ids';
import {
  DEPLOYMENT_LIST_FILTERS,
  countDeploymentsByFilter,
  filterDeployments,
  type DeploymentListFilter,
} from '../../domain/analysis/deploymentList';
import { DeploymentRow } from './DeploymentRow';
import type { VercelDeploymentSummary } from '../../domain/models/vercelModels';
import { EmptySitePrompt } from '../sites/EmptySitePrompt';

export function DeploymentsScreen() {
  const {
    connection,
    selectedProject,
    deployments,
    selectedDeployment,
    pollingDeploymentId,
    pollProgress,
    pollAttempt,
    pollMaxAttempts,
    lastError,
    selectDeployment,
    loadDeployments,
    runIncidentSummary,
    runDeploymentCompare,
  } = useApp();
  const previousPollingId = useRef<string | null>(null);
  const [filter, setFilter] = useState<DeploymentListFilter>('all');
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    if (lastError) AccessibilityInfo.announceForAccessibility(lastError);
  }, [lastError]);

  useEffect(() => {
    if (pollingDeploymentId) {
      AccessibilityInfo.announceForAccessibility(
        `Polling deployment ${pollingDeploymentId}`,
      );
    } else if (previousPollingId.current) {
      AccessibilityInfo.announceForAccessibility(
        'Deployment polling finished. Review Activity for the confirmed result.',
      );
    }
    previousPollingId.current = pollingDeploymentId;
  }, [pollingDeploymentId]);

  const counts = useMemo(
    () => countDeploymentsByFilter(deployments),
    [deployments],
  );
  const filtered = useMemo(
    () => filterDeployments(deployments, filter),
    [deployments, filter],
  );

  const onSelectRow = useCallback(
    (id: DeploymentID) => {
      void selectDeployment(id);
      openDeployment(id);
    },
    [selectDeployment],
  );

  const onDiagnose = useCallback(
    (id: DeploymentID) => {
      void selectDeployment(id).then(() => runIncidentSummary());
    },
    [selectDeployment, runIncidentSummary],
  );

  const onCompare = useCallback(
    (id: DeploymentID) => {
      void selectDeployment(id).then(() => runDeploymentCompare());
    },
    [selectDeployment, runDeploymentCompare],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: VercelDeploymentSummary; index: number }) => (
      <DeploymentRow
        deployment={item}
        selected={selectedDeployment?.id === item.id}
        last={index === filtered.length - 1}
        onPress={onSelectRow}
        onDiagnose={onDiagnose}
        onCompare={onCompare}
      />
    ),
    [
      onSelectRow,
      onDiagnose,
      onCompare,
      selectedDeployment?.id,
      filtered.length,
    ],
  );

  if (!connection.user) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.empty}
        contentInsetAdjustmentBehavior="automatic"
        testID={AccessibilityIDs.tabDeployments}
      >
        <Text style={styles.sub}>Connect in Settings first.</Text>
        <DataText>Open Settings → token</DataText>
      </ScrollView>
    );
  }

  if (!selectedProject) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.empty}
        contentInsetAdjustmentBehavior="automatic"
        testID={AccessibilityIDs.tabDeployments}
      >
        <EmptySitePrompt message="Choose a site to load deployments." />
      </ScrollView>
    );
  }

  const header = (
    <View style={styles.header}>
      {lastError ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Text style={styles.errorText}>{lastError}</Text>
        </View>
      ) : null}

      {pollingDeploymentId ? (
        <ContentCard>
          <SectionLabel>Deployment poll</SectionLabel>
          <DataText>Polling {pollingDeploymentId.slice(0, 14)}…</DataText>
          <Text style={styles.caption}>
            Attempt {pollAttempt}/{pollMaxAttempts} · READY only when Vercel
            confirms
          </Text>
          <ProgressBar
            progress={pollProgress ?? 0}
            accessibilityLabel="Deployment poll progress"
          />
        </ContentCard>
      ) : null}

      <SectionLabel>Recent deployments</SectionLabel>
      <View style={styles.filters}>
        {DEPLOYMENT_LIST_FILTERS.map((f) => (
          <FilterChip
            key={f.key}
            label={f.label}
            count={counts[f.key]}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.root} testID={AccessibilityIDs.tabDeployments}>
      <FlashList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        extraData={selectedDeployment?.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={styles.sub}>No deployments in this filter.</Text>
        }
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        testID={AccessibilityIDs.deploymentList}
        ItemSeparatorComponent={null}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => {
              setPulling(true);
              void loadDeployments(selectedProject.id).finally(() =>
                setPulling(false),
              );
            }}
            tintColor={colors.accent}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  empty: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  header: {
    padding: layout.screenPadding,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
    paddingHorizontal: layout.screenPadding,
  },
  sub: { ...typography.subhead },
  caption: { ...typography.caption, marginTop: 4 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    padding: spacing.md,
  },
  errorText: { ...typography.footnote, color: colors.danger },
});
