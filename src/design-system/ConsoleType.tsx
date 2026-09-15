import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, isIOS, radii, spacing, typography } from './theme';
import { deploymentStateTone, outcomeTone, type ConsoleStateTone } from './consoleState';

const toneColor: Record<ConsoleStateTone, string> = {
  ready: colors.ready,
  building: colors.building,
  error: colors.danger,
  neutral: colors.textSecondary,
};

export function DataText({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text
      style={[typography.monoBody, style]}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={1.3}
    >
      {children}
    </Text>
  );
}

export function StateWord({
  label,
  tone,
}: {
  label: string;
  tone?: ConsoleStateTone;
}) {
  const resolved = tone ?? deploymentStateTone(label);
  return (
    <Text
      style={[styles.state, { color: toneColor[resolved] }]}
      maxFontSizeMultiplier={1.3}
      accessibilityRole="text"
    >
      {label}
    </Text>
  );
}

export function OutcomeWord({ outcome }: { outcome: string }) {
  return <StateWord label={outcome.toUpperCase()} tone={outcomeTone(outcome)} />;
}

export function GroupedList({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.group, style]}>{children}</View>;
}

export function GroupedRow({
  children,
  last,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  selected,
}: {
  children: ReactNode;
  last?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  selected?: boolean;
}) {
  const inner = (
    <View style={[styles.row, !last && styles.rowRule, selected && styles.rowOn]}>
      {children}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
    >
      {inner}
    </Pressable>
  );
}

export function InsightChip({
  label,
  onPress,
  loading,
  selected,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!loading, selected: !!selected }}
      style={({ pressed }) => [
        styles.insight,
        selected && styles.insightOn,
        pressed && styles.insightPressed,
      ]}
    >
      <Text style={styles.insightLabel} maxFontSizeMultiplier={1.3}>
        {loading ? '…' : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  state: {
    ...typography.monoHeadline,
    minWidth: isIOS ? 72 : 64,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  rowRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rowOn: {
    backgroundColor: colors.accentSoft,
  },
  insight: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderCurve: 'continuous',
  },
  insightOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  insightPressed: { opacity: 0.7 },
  insightLabel: { ...typography.monoCaption, color: colors.text },
});
