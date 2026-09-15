import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import {
  colors,
  elevation,
  isIOS,
  motion,
  radii,
  spacing,
  touch,
  typography,
} from './theme';
import {
  canUseNativeLiquidGlass,
  chromeGlassColorScheme,
  chromeGlassEffectStyle,
  useReduceTransparency,
} from './liquidGlass';

export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  return reduceMotion;
}

/**
 * Navigation chrome only (tab bar, toolbar chips, FAB). Never wrap content cards.
 *
 * iOS 26+: native UIGlassEffect via expo-glass-effect.
 * Older iOS: BlurView.
 * Reduce Transparency / Android / web: opaque tonal surface.
 */
export function GlassSurface({
  children,
  style,
  intensity = isIOS ? 55 : 36,
  interactive = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  /** iOS glass glint; set at mount. Do not toggle without remounting. */
  interactive?: boolean;
}) {
  const reduceTransparency = useReduceTransparency();
  const nativeGlass = !reduceTransparency && canUseNativeLiquidGlass();

  if (nativeGlass) {
    return (
      <GlassView
        glassEffectStyle={chromeGlassEffectStyle}
        colorScheme={chromeGlassColorScheme}
        isInteractive={interactive}
        style={[styles.glassNative, style]}
      >
        {children}
      </GlassView>
    );
  }

  if (Platform.OS === 'ios' && !reduceTransparency) {
    return (
      <View style={[styles.glassOuter, elevation.mid, style]}>
        <BlurView
          intensity={intensity}
          tint="systemChromeMaterialDark"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.14)',
            'rgba(255,255,255,0.02)',
            'transparent',
          ]}
          style={styles.glassSheen}
          pointerEvents="none"
        />
        <View style={styles.glassInner}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.glassFallback, elevation.mid, style]}>{children}</View>
  );
}

/** Subtle iOS canvas wash so floating chrome has tone to refract. */
export function ChromeCanvas({ children }: { children: ReactNode }) {
  if (!isIOS) {
    return (
      <View style={[styles.canvas, { backgroundColor: colors.background }]}>
        {children}
      </View>
    );
  }
  return (
    <View style={[styles.canvas, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[
          colors.canvasWashTop,
          colors.canvasWashMid,
          colors.canvasWashBottom,
        ]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

/** Opaque sheet surface — glass is chrome-only. */
export function GlassSheetFrame({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.sheetOpaque, style]}>{children}</View>;
}

export function GlassIconButton({
  label,
  onPress,
  children,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  testID?: string;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconHit,
        pressed && !reduceMotion && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <GlassSurface style={styles.iconGlass} intensity={48} interactive>
        <View style={styles.iconContent}>{children}</View>
      </GlassSurface>
    </Pressable>
  );
}

/** M3 filled / iOS prominent. */
export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  testID,
  variant = 'primary',
  accessibilityHint,
  selected,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  variant?: 'primary' | 'danger' | 'ghost' | 'tonal';
  accessibilityHint?: string;
  selected?: boolean;
}) {
  const reduceMotion = useReduceMotion();
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';
  const isTonal = variant === 'tonal';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: !!disabled,
        busy: !!loading,
        selected,
      }}
      disabled={disabled || loading}
      onPress={() => {
        if (isDanger) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onPress();
      }}
      style={({ pressed }) => [
        styles.primaryBtn,
        isDanger && styles.dangerBtn,
        isGhost && styles.ghostBtn,
        isTonal && styles.tonalBtn,
        pressed &&
          (reduceMotion ? styles.primaryPressedReduced : styles.primaryPressed),
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          style={styles.loadingIndicator}
          color={
            isGhost || isTonal
              ? colors.accent
              : isDanger
                ? colors.onDanger
                : colors.textOnPrimary
          }
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <Text
        style={[
          styles.primaryLabel,
          isDanger && styles.dangerLabel,
          isGhost && styles.ghostLabel,
          isTonal && styles.tonalLabel,
          loading && styles.loadingLabel,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/** Opaque content card — HIG grouped / M3 surface-container. */
export function ContentCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.section}>{children.toUpperCase()}</Text>;
}

const PILL_TONES = {
  success: { bg: colors.successSoft, fg: colors.ready },
  warning: { bg: colors.warningSoft, fg: colors.building },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.accentSoft, fg: colors.accent },
  neutral: { bg: colors.pill, fg: colors.textSecondary },
} as const;

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: keyof typeof PILL_TONES;
}) {
  const { bg, fg } = PILL_TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>
        {label}
      </Text>
    </View>
  );
}

/** M3 button group / iOS segmented-style filter chip. */
export function FilterChip({
  label,
  selected,
  onPress,
  count,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  count?: number;
}) {
  const reduceMotion = useReduceMotion();
  const title = count != null ? `${label} ${count}` : label;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipOn,
        pressed && (reduceMotion ? styles.pressedReduced : styles.pressed),
      ]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Linear progress for READY poll — M3 linear / iOS continuous. */
export function ProgressBar({
  progress,
  accessibilityLabel,
}: {
  /** 0–1 */
  progress: number;
  accessibilityLabel?: string;
}) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={styles.progressTrack}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
      accessibilityLabel={accessibilityLabel ?? 'Progress'}
    >
      <View style={[styles.progressFill, { width: `${p * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  glassNative: {
    borderRadius: radii.xxl,
    borderCurve: 'continuous',
  },
  sheetOpaque: {
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  glassOuter: {
    borderRadius: radii.xxl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  glassInner: { position: 'relative' },
  glassSheen: {
    ...StyleSheet.absoluteFill,
    height: '55%',
  },
  glassFallback: {
    borderRadius: radii.xxl,
    backgroundColor: colors.glassFillStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  iconHit: { minWidth: touch.min, minHeight: touch.min },
  iconGlass: { borderRadius: radii.pill },
  iconContent: {
    width: touch.icon,
    height: touch.icon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: motion.pressScale }] },
  pressedReduced: { opacity: 0.78 },
  disabled: { opacity: 0.38 },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.button,
    borderCurve: 'continuous',
    minHeight: touch.min,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtn: { backgroundColor: colors.danger },
  ghostBtn: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tonalBtn: {
    backgroundColor: colors.accentSoft,
  },
  primaryPressed: { opacity: 0.88 },
  primaryPressedReduced: { opacity: 0.88 },
  loadingIndicator: { position: 'absolute' },
  loadingLabel: { opacity: 0 },
  primaryLabel: { ...typography.headline, color: colors.textOnPrimary },
  dangerLabel: { color: colors.onDanger },
  ghostLabel: { color: colors.text },
  tonalLabel: { color: colors.onAccentContainer },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderCurve: 'continuous',
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  section: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  pillText: { ...typography.caption, fontWeight: '600' },
  progressTrack: {
    height: isIOS ? 4 : 4,
    borderRadius: radii.pill,
    backgroundColor: colors.progressTrack,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.progressFill,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipLabel: { ...typography.caption, fontWeight: '600', color: colors.textSecondary },
  chipLabelOn: { color: colors.accent },
});
