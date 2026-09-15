import { colors } from '../design-system/theme';

/**
 * Inline titles (not large) so the site switcher is always tappable and
 * content does not sit under the status bar / refresh control.
 */
export const tabStackScreenOptions = {
  headerLargeTitle: false,
  headerTransparent: false,
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  headerTitleAlign: 'center' as const,
  contentStyle: { backgroundColor: colors.background },
} as const;
