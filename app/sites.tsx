import { ScrollView } from 'react-native';
import { SitePickerSheet } from '../src/features/sites/SitePickerSheet';
import { colors, spacing } from '../src/design-system/theme';

export default function SitesRoute() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.backgroundElevated }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: spacing.xxxl, paddingTop: spacing.sm }}
    >
      <SitePickerSheet />
    </ScrollView>
  );
}
