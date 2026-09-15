import { StyleSheet, Text } from 'react-native';
import { useApp } from '../shell/AppContext';
import { onDevicePrivacyLine } from '../services/ai/onDeviceModel';
import { typography } from './theme';

/** At most one of these per screen. Hidden when the OS model is unavailable. */
export function OnDevicePrivacyNote() {
  const { onDeviceAvailable } = useApp();
  const line = onDevicePrivacyLine();
  if (!onDeviceAvailable || !line) return null;
  return (
    <Text style={styles.line} maxFontSizeMultiplier={1.3}>
      {line}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { ...typography.caption },
});
