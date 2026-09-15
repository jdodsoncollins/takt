import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../design-system/theme';

export function SheetDoneButton() {
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Done"
      hitSlop={10}
      style={{ justifyContent: 'center' }}
    >
      <Text
        style={{
          fontSize: 17,
          fontWeight: '600',
          lineHeight: 22,
          color: colors.accent,
        }}
      >
        Done
      </Text>
    </Pressable>
  );
}
