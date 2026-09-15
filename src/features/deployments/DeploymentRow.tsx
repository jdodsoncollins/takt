import { memo } from 'react';
import {
  ActionSheetIOS,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '../../design-system/theme';
import {
  DataText,
  GroupedRow,
  StateWord,
} from '../../design-system/ConsoleType';
import { DeploymentPreviewThumb } from '../../design-system/DeploymentPreviewThumb';
import { useDeploymentPreview } from './useDeploymentPreview';
import { SymbolIcon } from '../../design-system/SymbolIcon';
import {
  deploymentListMetaLine,
  deploymentTitle,
} from '../../domain/analysis/deploymentList';
import type { VercelDeploymentSummary } from '../../domain/models/vercelModels';

export const DeploymentRow = memo(function DeploymentRow({
  deployment,
  selected,
  last,
  onPress,
  onDiagnose,
  onCompare,
  selectsOnly,
}: {
  deployment: VercelDeploymentSummary;
  selected: boolean;
  last?: boolean;
  onPress: (id: VercelDeploymentSummary['id']) => void;
  onDiagnose?: (id: VercelDeploymentSummary['id']) => void;
  onCompare?: (id: VercelDeploymentSummary['id']) => void;
  /** Search embeds rows as selectors, not tab/sheet launches. */
  selectsOnly?: boolean;
}) {
  const title = deploymentTitle(deployment);
  const previewUrl = useDeploymentPreview(deployment.url, deployment.state);
  const meta = deploymentListMetaLine(deployment);

  const showMenu = () => {
    if (Platform.OS !== 'ios') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const options = ['Cancel', 'Open', 'Diagnose', 'Compare'];
    if (deployment.url) options.push('Open URL');
    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex: 0 },
      (index) => {
        if (index === 1) onPress(deployment.id);
        if (index === 2) onDiagnose?.(deployment.id);
        if (index === 3) onCompare?.(deployment.id);
        if (index === 4 && deployment.url) {
          const url = deployment.url.startsWith('http')
            ? deployment.url
            : `https://${deployment.url}`;
          void Linking.openURL(url);
        }
      },
    );
  };

  return (
    <Pressable
      onPress={() => onPress(deployment.id)}
      onLongPress={selectsOnly ? undefined : showMenu}
      delayLongPress={380}
    >
      <GroupedRow
        last={last}
        selected={selected}
        accessibilityLabel={`${deployment.state} ${deployment.target ?? 'no target'}, ${title}`}
        accessibilityHint={
          selectsOnly
            ? 'Selects this deployment for in-Search results'
            : 'Opens deployment detail. Long-press for diagnose, compare, or URL.'
        }
      >
        <StateWord label={deployment.state} />
        <DeploymentPreviewThumb imageUrl={previewUrl} variant="chip" />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <DataText numberOfLines={1}>{meta}</DataText>
        </View>
        <SymbolIcon name="chevron.right" size={14} color={colors.textTertiary} />
      </GroupedRow>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  body: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.headline },
});
