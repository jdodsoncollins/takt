import { Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { SFSymbol } from 'expo-symbols';
import { colors } from './theme';
import { SymbolIcon } from './SymbolIcon';

/** Native stack header control — SF Symbol, no custom glass (the nav bar is system glass). */
export function HeaderIconButton({
  name,
  label,
  onPress,
  testID,
  disabled,
}: {
  name: SFSymbol;
  label: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <SymbolIcon name={name} size={22} color={colors.text} weight="medium" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  pressed: { opacity: 0.55 },
  disabled: { opacity: 0.35 },
});