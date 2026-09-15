import { StyleSheet, Text, View } from 'react-native';
import {
  DataText,
  GroupedRow,
  StateWord,
} from '../../design-system/ConsoleType';
import { colors, spacing, typography } from '../../design-system/theme';
import { deploymentStateTone } from '../../design-system/consoleState';
import { buildProjectHealthCard } from '../../domain/analysis/projectHealth';
import {
  siteCommitLine,
  siteMetaLine,
  siteRepoLabel,
  siteSubtitle,
  siteTitle,
} from '../../domain/models/siteScope';
import type { VercelProject } from '../../domain/models/vercelModels';

export function SiteRow({
  project,
  last,
  selected,
  onPress,
  accessibilityHint,
}: {
  project: VercelProject;
  last?: boolean;
  selected?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
}) {
  const health = buildProjectHealthCard(project);
  const state = project.productionDeployment?.state ?? 'NO PROD';
  const tone =
    health.level === 'critical'
      ? 'error'
      : health.level === 'degraded'
        ? 'building'
        : health.level === 'healthy'
          ? 'ready'
          : deploymentStateTone(state);
  const title = siteTitle(project);
  const meta = siteMetaLine(project);
  const commit = siteCommitLine(project);
  const fallback = siteSubtitle(project);
  const repo = siteRepoLabel(project);

  return (
    <GroupedRow
      last={last}
      selected={selected}
      onPress={onPress}
      accessibilityLabel={[title, state, repo].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
    >
      <StateWord label={state} tone={tone} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {meta ? <DataText numberOfLines={1}>{meta}</DataText> : null}
        {commit ? <DataText numberOfLines={1}>{commit}</DataText> : null}
        {!meta && !commit && fallback ? (
          <DataText numberOfLines={1}>{fallback}</DataText>
        ) : null}
      </View>
    </GroupedRow>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, minWidth: 0, gap: 2, paddingVertical: spacing.xs },
  title: { ...typography.headline, color: colors.text },
});
