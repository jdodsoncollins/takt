import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useApp } from '../../shell/AppContext';
import { colors, spacing, typography } from '../../design-system/theme';
import { ContentCard, SectionLabel } from '../../design-system/GlassChrome';
import {
  DataText,
  GroupedList,
  GroupedRow,
} from '../../design-system/ConsoleType';
import {
  classifyDeploymentHosts,
  hostHref,
  hostKindLabel,
  hostsSummary,
  type ClassifiedHost,
  type DeploymentHostKind,
} from '../../domain/analysis/deploymentHosts';
import { availabilityLabel } from '../../domain/analysis/dataAvailability';

const KIND_ORDER: DeploymentHostKind[] = [
  'production',
  'alias',
  'branch',
  'commit',
  'other',
];

export function DeploymentHostsSheet({
  deploymentId,
}: {
  deploymentId?: string;
}) {
  const { selectedProject, selectedDeployment, connection } = useApp();

  const report = useMemo(() => {
    if (!selectedDeployment || !selectedProject) return null;
    const teamSlug =
      connection.teams.find((t) => t.id === connection.selectedTeamId)?.slug ??
      null;
    return classifyDeploymentHosts(selectedDeployment.aliases ?? [], {
      projectName: selectedProject.name,
      teamSlug,
      commitSha: selectedDeployment.meta.githubCommitSha,
      deploymentId: selectedDeployment.id,
      branch: selectedDeployment.meta.githubCommitRef,
      productionDomains: [selectedProject.primaryDomain],
      deploymentUrl: selectedDeployment.url,
    });
  }, [connection.selectedTeamId, connection.teams, selectedDeployment, selectedProject]);

  if (
    !selectedDeployment ||
    !selectedProject ||
    !report ||
    (deploymentId && selectedDeployment.id !== deploymentId)
  ) {
    return (
      <View style={styles.screen}>
        <Text style={styles.caption}>Select a deployment to inspect hosts.</Text>
      </View>
    );
  }

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    hosts:
      kind === 'alias'
        ? report.aliases
        : kind === 'production'
          ? report.production
          : kind === 'branch'
            ? report.branch
            : kind === 'commit'
              ? report.commit
              : report.other,
  })).filter((group) => group.hosts.length > 0);

  return (
    <View style={styles.screen}>
      <FlashList
        data={groups}
        keyExtractor={(group) => group.kind}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <DataText>{hostsSummary(report)}</DataText>
            {report.availability !== 'ok' ? (
              <ContentCard>
                <SectionLabel>Hosts</SectionLabel>
                <Text style={styles.caption}>
                  {availabilityLabel(report.availability)}
                  {report.note ? ` — ${report.note}` : ''}
                </Text>
              </ContentCard>
            ) : null}
          </View>
        }
        renderItem={renderHostGroup}
      />
    </View>
  );
}

function renderHostGroup({
  item,
}: {
  item: { kind: DeploymentHostKind; hosts: ClassifiedHost[] };
}) {
  return <HostGroup label={hostKindLabel(item.kind)} hosts={item.hosts} />;
}

function HostGroup({
  label,
  hosts,
}: {
  label: string;
  hosts: ClassifiedHost[];
}) {
  return (
    <View style={styles.group}>
      <SectionLabel>{label}</SectionLabel>
      <GroupedList>
        {hosts.map((row, i) => (
          <GroupedRow
            key={row.host}
            last={i === hosts.length - 1}
            onPress={() => {
              void Linking.openURL(hostHref(row.host));
            }}
            accessibilityLabel={row.host}
            accessibilityHint="Opens this host in the browser"
          >
            <DataText numberOfLines={2}>{row.host}</DataText>
          </GroupedRow>
        ))}
      </GroupedList>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundElevated },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  header: { gap: spacing.md, marginBottom: spacing.md },
  group: { gap: spacing.sm, marginBottom: spacing.md },
  caption: { ...typography.caption },
});
