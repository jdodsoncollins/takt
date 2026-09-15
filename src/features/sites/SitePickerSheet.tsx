import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useApp } from '../../shell/AppContext';
import { closeModal } from '../../shell/nav';
import { rankSites } from '../../domain/models/siteScope';
import { colors, radii, spacing, typography } from '../../design-system/theme';
import { SectionLabel } from '../../design-system/GlassChrome';
import { DataText, GroupedList } from '../../design-system/ConsoleType';
import { AccessibilityIDs } from '../../support/accessibilityIDs';
import { SiteRow } from './SiteRow';

export function SitePickerSheet() {
  const { projects, selectedProjectId, selectProject, isBusy } = useApp();
  const [query, setQuery] = useState('');
  const ranked = useMemo(() => rankSites(projects, query), [projects, query]);

  return (
    <View style={styles.root} testID={AccessibilityIDs.sitePicker}>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Filter sites"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Filter sites"
      />
      <SectionLabel>
        {query.trim() ? 'Matches' : 'Attention first'}
      </SectionLabel>
      {ranked.length === 0 ? (
        <DataText>
          {isBusy ? 'Loading sites…' : 'No sites match this filter.'}
        </DataText>
      ) : (
        <GroupedList>
          {ranked.map((p, i) => (
            <SiteRow
              key={p.id}
              project={p}
              last={i === ranked.length - 1}
              selected={selectedProjectId === p.id}
              onPress={() => {
                void selectProject(p.id).then(() => closeModal());
              }}
              accessibilityHint="Selects this site without changing tabs"
            />
          ))}
        </GroupedList>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  search: {
    ...typography.body,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
});
