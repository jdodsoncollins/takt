import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { DeploymentPreviewThumb } from '../../design-system/DeploymentPreviewThumb';
import { StateWord } from '../../design-system/ConsoleType';
import {
  colors,
  radii,
  spacing,
  touch,
  typography,
} from '../../design-system/theme';
import { deploymentStateTone } from '../../design-system/consoleState';
import { useDeploymentPreview } from '../deployments/useDeploymentPreview';
import {
  siteClearWord,
  siteStampAge,
  siteStampGit,
  siteStampProd,
} from '../../domain/models/siteScope';
import type { VercelProject } from '../../domain/models/vercelModels';
import { AccessibilityIDs } from '../../support/accessibilityIDs';

export function SiteRack({
  project,
  onDiagnose,
  canDiagnose,
}: {
  project: VercelProject;
  onDiagnose?: () => void;
  canDiagnose?: boolean;
}) {
  const prod = project.productionDeployment;
  const previewUrl = useDeploymentPreview(prod?.url ?? null, prod?.state ?? 'UNKNOWN');
  const clear = siteClearWord(project);
  const age = siteStampAge(project);
  const prodLabel = siteStampProd(project);
  const git = siteStampGit(project);
  const state = prod?.state ?? 'NONE';
  const stateTone = deploymentStateTone(state);

  return (
    <View
      accessibilityLabel={`${clear.label}. ${state}. ${prodLabel}. ${git}. ${age.label}.`}
    >
      <View style={styles.plate}>
        <DeploymentPreviewThumb imageUrl={previewUrl} variant="banner" />
      </View>
      <View style={styles.stamp}>
        <View style={styles.statusRow}>
          <StateWord label={clear.label} tone={clear.tone} />
          <Text style={styles.dot}>·</Text>
          <StateWord label={state} tone={stateTone} />
        </View>
        <View
          style={styles.tick}
          accessibilityLabel={`Age ${age.label}`}
        >
          <View style={[styles.tickFill, { width: `${Math.round(age.fill * 100)}%` }]} />
        </View>
        <View style={styles.grid}>
          <StampCell k="PROD" v={prodLabel} />
          <StampCell k="GIT" v={git} />
          <StampCell k="AGE" v={age.label} />
        </View>
      </View>
      {canDiagnose && onDiagnose ? (
        <Pressable
          testID={AccessibilityIDs.diagnose}
          accessibilityRole="button"
          accessibilityLabel="Diagnose"
          accessibilityHint="Runs a local on-device check from loaded site signals"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onDiagnose();
          }}
          style={({ pressed }) => [styles.diagnose, pressed && styles.diagnosePressed]}
        >
          <Text style={styles.diagnoseLabel}>DIAGNOSE</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StampCell({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellK}>{k}</Text>
      <Text style={styles.cellV} numberOfLines={1}>
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    padding: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stamp: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderRadius: radii.plate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dot: { ...typography.monoHeadline, color: colors.textSecondary },
  tick: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.progressTrack,
    overflow: 'hidden',
  },
  tickFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cell: { flex: 1, minWidth: 0 },
  cellK: {
    ...typography.label,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  cellV: {
    ...typography.monoHeadline,
    color: colors.text,
  },
  diagnose: {
    marginTop: spacing.md,
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.stamp,
  },
  diagnosePressed: { opacity: 0.85 },
  diagnoseLabel: {
    ...typography.monoHeadline,
    color: colors.textOnAccent,
    letterSpacing: 1.4,
    fontSize: 14,
  },
});
