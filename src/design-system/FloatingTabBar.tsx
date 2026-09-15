import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SFSymbol } from 'expo-symbols';
import { GlassSurface } from './GlassChrome';
import { SymbolIcon } from './SymbolIcon';
import { tabSymbol } from './tabSymbol';
import { colors, isIOS, layout, radii, spacing, typography } from './theme';
import type { AppTab } from '../shell/AppContext';

type TabItem = {
  key: AppTab;
  label: string;
  sf: SFSymbol;
  sfFill: SFSymbol;
  testID: string;
  badge?: boolean;
};

/**
 * Floating capsule tab bar:
 * - iOS Liquid Glass navigation layer
 * - Android M3 bottom nav with active indicator pill
 */
export function FloatingTabBar({
  tabs,
  activeTab,
  onChange,
  trailing,
}: {
  tabs: TabItem[];
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
  /** iOS search-island style control (assistant). */
  trailing?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, spacing.sm);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: bottom }]}
    >
      <View style={styles.cluster}>
      <GlassSurface style={styles.bar} intensity={isIOS ? 64 : 40} interactive>
        <View style={styles.row} accessibilityRole="tablist">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            const tint = (active ? colors.tabActive : colors.tabInactive) as string;
            return (
              <Pressable
                key={tab.key}
                onPress={() => onChange(tab.key)}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: active, busy: tab.badge }}
                accessibilityLabel={
                  tab.badge
                    ? `${tab.label}, deployment polling in progress`
                    : tab.label
                }
                accessibilityHint={`Shows the ${tab.label} screen`}
                testID={tab.testID}
              >
                <View style={[styles.indicator, !isIOS && active && styles.indicatorOn]}>
                  <SymbolIcon
                    name={tabSymbol(tab.sf, tab.sfFill, active)}
                    size={isIOS ? 24 : 22}
                    color={tint}
                    weight={active ? 'medium' : 'regular'}
                  />
                </View>
                <Text
                  style={[styles.label, active && styles.labelOn]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.2}
                >
                  {tab.label}
                </Text>
                {tab.badge ? (
                  <View style={styles.badge} accessible={false} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
      {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.tabBarMargin,
  },
  cluster: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  bar: {
    flex: 1,
    borderRadius: isIOS ? radii.pill : radii.xl,
  },
  row: {
    flexDirection: 'row',
    minHeight: layout.tabBarHeight,
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  indicator: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    minWidth: isIOS ? 48 : 64,
    alignItems: 'center',
  },
  indicatorOn: {
    backgroundColor: colors.accentSoft,
  },
  label: {
    ...typography.caption,
    fontSize: isIOS ? 10 : 12,
    lineHeight: isIOS ? 13 : 16,
    marginTop: 2,
    color: colors.tabInactive,
    textAlign: 'center',
  },
  labelOn: {
    color: colors.tabActive,
    fontWeight: isIOS ? '500' : '600',
  },
  badge: {
    position: 'absolute',
    right: spacing.lg,
    top: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning,
  },
});
