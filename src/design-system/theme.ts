import { Platform, PlatformColor, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Design tokens — platform-adaptive:
 * - iOS: HIG + Liquid Glass (chrome only: tab bar, toolbar, FAB)
 * - Android: Material Design 3 / Material You (tonal surfaces, FAB shapes)
 *
 * Content stays on opaque tonal surfaces. Glass never wraps list content.
 */

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

/**
 * Dark ops canvas: iron-black, hairline copper, one accent.
 * Not a Vercel brand copy (no Geist, no triangle, no their marketing hexes).
 */
export const colors = {
  // Canvas (content layer) — iron black, not cool OLED
  background: isIOS ? '#0C0908' : '#0E0E11',
  backgroundElevated: isIOS ? '#161310' : '#1A1A1F',
  surface: isIOS ? '#171412' : '#1C1B1F',
  surfaceMuted: isIOS ? '#221E1B' : '#2B2930',
  surfaceVariant: isIOS ? '#2C2824' : '#49454F',
  surfaceContainer: isIOS ? '#221E1B' : '#211F26',
  surfaceContainerHigh: isIOS ? '#2C2824' : '#2B2930',

  // Ink
  text: isIOS ? '#F7F1EA' : '#E6E1E5',
  textSecondary: isIOS ? 'rgba(247,241,234,0.62)' : '#CAC4D0',
  textTertiary: isIOS ? 'rgba(247,241,234,0.58)' : '#CAC4D0',
  textOnPrimary: isAndroid ? '#FFFFFF' : '#1A1410',
  textOnAccent: isAndroid ? '#FFFFFF' : '#1A1410',

  // Brand — iOS copper; Android 12+ Material You accent
  accent: isIOS
    ? '#C4784A'
    : isAndroid
      ? PlatformColor('@android:color/system_accent1_200')
      : '#C4784A',
  accentSoft: isIOS ? 'rgba(196,120,74,0.16)' : '#4A4458',
  accentContainer: isIOS ? 'rgba(196,120,74,0.22)' : '#4F378B',
  onAccentContainer: isIOS ? '#F6E6DC' : '#EADDFF',

  // FAB (M3 primary container / iOS prominent)
  fab: isIOS
    ? '#FFFFFF'
    : isAndroid
      ? PlatformColor('@android:color/system_accent1_200')
      : '#D0BCFF',
  fabPressed: isIOS ? '#E5E5EA' : '#B69DF8',
  fabOn: isIOS ? '#1A1410' : '#381E72',

  // Semantic (HIG system colors / M3 error-tertiary)
  danger: isIOS ? '#FF453A' : '#F2B8B5',
  onDanger: isIOS ? '#1A1410' : '#601410',
  dangerSoft: isIOS ? 'rgba(255,69,58,0.18)' : '#8C1D18',
  warning: isIOS ? '#FFD60A' : '#EFB8C8',
  warningSoft: isIOS ? 'rgba(255,214,10,0.16)' : '#492532',
  success: isIOS ? '#30D158' : '#A6D9B5',
  successSoft: isIOS ? 'rgba(48,209,88,0.16)' : '#0F5132',
  /** Console READY / live — mint phosphor, not toy CRT green. */
  ready: isIOS ? '#7CDECC' : '#A6D9B5',
  building: isIOS ? '#FFC14D' : '#EFB8C8',

  // Chrome — hairline copper, not cool gray
  border: isIOS ? 'rgba(196,120,74,0.35)' : '#49454F',
  separator: isIOS ? 'rgba(247,241,234,0.10)' : '#49454F',
  tabInactive: isIOS ? 'rgba(247,241,234,0.55)' : '#CAC4D0',
  tabActive: isIOS
    ? '#F7F1EA'
    : isAndroid
      ? PlatformColor('@android:color/system_accent1_200')
      : '#C4784A',
  pill: isIOS ? 'rgba(196,120,74,0.12)' : '#49454F',
  pillActive: isIOS ? '#C4784A' : '#EADDFF',

  // Liquid Glass / M3 surface-container chrome
  glassFill: isIOS ? 'rgba(22,19,16,0.55)' : 'rgba(28,27,31,0.94)',
  glassFillStrong: isIOS ? 'rgba(34,30,27,0.78)' : 'rgba(33,31,38,0.98)',
  glassBorder: isIOS ? 'rgba(247,241,234,0.18)' : 'rgba(147,143,153,0.28)',
  glassHighlight: isIOS ? 'rgba(196,120,74,0.12)' : 'rgba(255,255,255,0.04)',
  scrim: isIOS ? 'rgba(12,9,8,0.5)' : 'rgba(0,0,0,0.5)',

  // Poll / progress
  progressTrack: isIOS ? 'rgba(196,120,74,0.2)' : '#49454F',
  progressFill: isIOS
    ? '#C4784A'
    : isAndroid
      ? PlatformColor('@android:color/system_accent1_200')
      : '#C4784A',

  /** iOS canvas wash so Liquid Glass chrome has iron/copper to refract. */
  canvasWashTop: '#0C0908',
  canvasWashMid: '#120E0C',
  canvasWashBottom: '#2A1C14',
} as const;

/** 8pt grid (HIG + Material). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/**
 * Corner radii:
 * - iOS Liquid Glass: continuous large radii on chrome capsules
 * - M3: shape scale (extra-small 4 → full 28 for FAB/nav)
 */
export const radii = {
  sm: isIOS ? 8 : 8,
  md: isIOS ? 12 : 12,
  lg: isIOS ? 16 : 16,
  xl: isIOS ? 22 : 20,
  xxl: isIOS ? 28 : 28,
  pill: 999,
  fab: isIOS ? 28 : 16,
  card: isIOS ? 16 : 16,
  plate: 6,
  sheet: isIOS ? 16 : 28,
  button: isIOS ? 12 : 20,
  stamp: 4,
} as const;

const consoleMono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
}) as string;

/** 44pt HIG / 48dp M3 — use 48 for shared minimum. */
export const touch = {
  min: 48,
  icon: 44,
} as const;

export const typography = {
  largeTitle: {
    fontSize: isIOS ? 34 : 32,
    fontWeight: '700' as const,
    letterSpacing: isIOS ? 0.37 : 0,
    lineHeight: isIOS ? 41 : 40,
    color: colors.text,
  } satisfies TextStyle,
  title1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    color: colors.text,
  } satisfies TextStyle,
  title2: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    color: colors.text,
  } satisfies TextStyle,
  title3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 25,
    color: colors.text,
  } satisfies TextStyle,
  headline: {
    fontSize: isIOS ? 17 : 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: isAndroid ? 0.15 : 0,
    color: colors.text,
  } satisfies TextStyle,
  body: {
    fontSize: isIOS ? 17 : 16,
    fontWeight: '400' as const,
    lineHeight: 22,
    letterSpacing: isAndroid ? 0.5 : 0,
    color: colors.text,
  } satisfies TextStyle,
  subhead: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
    color: colors.textSecondary,
  } satisfies TextStyle,
  footnote: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: colors.textSecondary,
  } satisfies TextStyle,
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    letterSpacing: isAndroid ? 0.4 : 0,
    color: colors.textTertiary,
  } satisfies TextStyle,
  label: {
    fontSize: isIOS ? 11 : 11,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: isIOS ? 1.2 : 0.8,
    color: colors.textSecondary,
  } satisfies TextStyle,
  mono: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    fontFamily: consoleMono,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
    color: colors.textSecondary,
  } satisfies TextStyle,
  monoCaption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    fontFamily: consoleMono,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
    letterSpacing: 0.4,
    color: colors.textSecondary,
  } satisfies TextStyle,
  monoBody: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    fontFamily: consoleMono,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
    color: colors.textSecondary,
  } satisfies TextStyle,
  monoHeadline: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
    fontFamily: consoleMono,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
    letterSpacing: 0.6,
    color: colors.text,
  } satisfies TextStyle,
} as const;

export const elevation = {
  none: {} as ViewStyle,
  low: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 1 },
    default: {},
  })!,
  mid: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
    },
    android: { elevation: 3 },
    default: {},
  })!,
  high: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 14 },
    },
    android: { elevation: 6 },
    default: {},
  })!,
} as const;

export const motion = {
  /** Prefer reduced motion when system setting is on — consumers check AccessibilityInfo. */
  pressScale: 0.97,
  durationFast: 120,
  duration: 200,
} as const;

export const layout = {
  screenPadding: spacing.lg,
  tabBarHeight: isIOS ? 64 : 80,
  tabBarMargin: spacing.lg,
  fabSize: isIOS ? 56 : 56,
  /** Scroll padding so the last row can rest above the floating chrome. */
  contentBottomInset: isIOS ? 132 : 176,
  sectionGap: spacing.lg,
} as const;
