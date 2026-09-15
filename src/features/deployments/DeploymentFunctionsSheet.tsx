import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../shell/AppContext';
import { colors, spacing, typography } from '../../design-system/theme';
import { ContentCard, SectionLabel } from '../../design-system/GlassChrome';
import {
  DataText,
  GroupedList,
  GroupedRow,
} from '../../design-system/ConsoleType';
import {
  formatFunctionSize,
  functionKindLabel,
} from '../../domain/analysis/deploymentFunctions';
import { availabilityLabel } from '../../domain/analysis/dataAvailability';

export function DeploymentFunctionsSheet({
  deploymentId,
}: {
  deploymentId?: string;
}) {
  const {
    selectedDeployment,
    selectedProject,
    deploymentFunctions,
    loadDeploymentFunctions,
    busyKey,
    lastError,
  } = useApp();

  const matches =
    !!selectedDeployment &&
    (!deploymentId || selectedDeployment.id === deploymentId);

  useEffect(() => {
    if (matches) void loadDeploymentFunctions();
  }, [loadDeploymentFunctions, matches, selectedDeployment?.id]);

  const loading = busyKey === 'functions' || busyKey === 'deployment';

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {!matches || !selectedProject ? (
          <Text style={styles.caption}>
            {loading
              ? 'Loading this deployment…'
              : 'Select a deployment to inspect functions.'}
          </Text>
        ) : loading && !deploymentFunctions ? (
          <Text style={styles.caption}>Loading function inventory…</Text>
        ) : lastError && !deploymentFunctions ? (
          <ContentCard>
            <SectionLabel>Functions</SectionLabel>
            <Text style={styles.caption}>{lastError}</Text>
          </ContentCard>
        ) : !deploymentFunctions ? (
          <Text style={styles.caption}>No function inventory yet.</Text>
        ) : deploymentFunctions.availability !== 'ok' ? (
          <ContentCard>
            <SectionLabel>Functions</SectionLabel>
            <Text style={styles.bodyText}>
              {availabilityLabel(deploymentFunctions.availability)}
              {deploymentFunctions.note
                ? ` — ${deploymentFunctions.note}`
                : ''}
            </Text>
          </ContentCard>
        ) : (
          <>
            {deploymentFunctions.note ? (
              <ContentCard>
                <Text style={styles.caption}>{deploymentFunctions.note}</Text>
              </ContentCard>
            ) : null}
            <DataText>
              {deploymentFunctions.functions.length} function
              {deploymentFunctions.functions.length === 1 ? '' : 's'}
              {deploymentFunctions.source === 'file-tree'
                ? ' · published routes'
                : deploymentFunctions.source === 'lambda-output'
                  ? ' · hashed output ids'
                  : ''}
            </DataText>
            <GroupedList>
              {deploymentFunctions.functions.map((fn, i) => {
                const meta = [
                  functionKindLabel(fn.kind),
                  fn.runtime,
                  fn.memoryMb != null ? `${fn.memoryMb} MB` : null,
                  formatFunctionSize(fn.sizeBytes),
                  fn.readyState,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <GroupedRow
                    key={fn.id}
                    last={i === deploymentFunctions.functions.length - 1}
                    accessibilityLabel={`${fn.route}, ${meta}`}
                  >
                    <View style={styles.fn}>
                      <DataText numberOfLines={2}>{fn.route}</DataText>
                      {meta ? <Text style={styles.caption}>{meta}</Text> : null}
                    </View>
                  </GroupedRow>
                );
              })}
            </GroupedList>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundElevated },
  body: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  fn: { flex: 1, minWidth: 0, gap: 2, paddingVertical: spacing.xs },
  bodyText: { ...typography.body, marginTop: 4 },
  caption: { ...typography.caption },
});
