import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useApp } from '../../shell/AppContext';
import { openSitePicker } from '../../shell/nav';
import { siteTitle } from '../../domain/models/siteScope';
import { connectionIsConnected } from '../../domain/models/vercelModels';
import { SymbolIcon } from '../../design-system/SymbolIcon';
import { colors, typography } from '../../design-system/theme';
import { AccessibilityIDs } from '../../support/accessibilityIDs';

/** Tappable stack title: current site, or Choose a site. */
export function SiteScopeTitle() {
  const { selectedProject, connection } = useApp();
  const connected = connectionIsConnected(connection);
  const label = !connected
    ? 'Taktung'
    : selectedProject
      ? siteTitle(selectedProject).toUpperCase()
      : 'Choose a site';

  return (
    <Pressable
      onPress={() => {
        if (!connected) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        openSitePicker();
      }}
      disabled={!connected}
      accessibilityRole="button"
      accessibilityLabel={
        connected ? `Site, ${label}. Opens site picker.` : label
      }
      testID={AccessibilityIDs.siteTitle}
      hitSlop={8}
      style={({ pressed }) => [styles.hit, pressed && connected && styles.pressed]}
    >
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>
          {label}
        </Text>
        {connected ? (
          <SymbolIcon
            name="chevron.down"
            size={12}
            color={colors.textSecondary}
            weight="semibold"
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { maxWidth: 260, paddingHorizontal: 8, paddingVertical: 6 },
  pressed: { opacity: 0.55 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  title: {
    ...typography.monoHeadline,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
