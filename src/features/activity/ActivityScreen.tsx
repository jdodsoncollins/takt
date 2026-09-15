import {
  AccessibilityInfo,
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useMemo, useState } from 'react';
import { useApp } from '../../shell/AppContext';
import { colors, layout, spacing } from '../../design-system/theme';
import { FilterChip, PrimaryButton } from '../../design-system/GlassChrome';
import { AccessibilityIDs } from '../../support/accessibilityIDs';
import { ActivityListSection } from '../ops/OpsSections';
import { EmptySitePrompt } from '../sites/EmptySitePrompt';

export function ActivityScreen() {
  const { recentActivity, clearActivity, selectedProject } = useApp();
  const [scope, setScope] = useState<'site' | 'all'>('site');

  const items = useMemo(() => {
    if (scope !== 'site' || !selectedProject) return recentActivity;
    return recentActivity.filter(
      (item) => item.projectId == null || item.projectId === selectedProject.id,
    );
  }, [recentActivity, scope, selectedProject]);

  const confirmClear = () => {
    Alert.alert(
      'Clear activity?',
      `Permanently remove ${recentActivity.length} locally stored activity ${recentActivity.length === 1 ? 'entry' : 'entries'} from this device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear activity',
          style: 'destructive',
          onPress: () => {
            void clearActivity().then(() =>
              AccessibilityInfo.announceForAccessibility('Activity cleared'),
            );
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root} testID={AccessibilityIDs.tabActivity}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {selectedProject ? (
          <View style={styles.filters}>
            <FilterChip
              label="This site"
              selected={scope === 'site'}
              onPress={() => setScope('site')}
            />
            <FilterChip
              label="All"
              selected={scope === 'all'}
              onPress={() => setScope('all')}
            />
          </View>
        ) : (
          <EmptySitePrompt message="Choose a site to filter this list, or use All." />
        )}

        <PrimaryButton
          title="Clear activity"
          onPress={confirmClear}
          variant="danger"
          disabled={recentActivity.length === 0}
          accessibilityHint="Shows a confirmation before deleting local activity history"
        />

        <ActivityListSection items={items} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
