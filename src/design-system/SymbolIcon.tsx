import { Text } from 'react-native';
import { SymbolView, type SFSymbol, type SymbolWeight } from 'expo-symbols';

const fallbackGlyph: Partial<Record<string, string>> = {
  house: '⌂',
  'house.fill': '⌂',
  'arrow.up.forward.app': '↗',
  'arrow.up.forward.app.fill': '↗',
  clock: '◷',
  'clock.fill': '◷',
  gearshape: '⚙',
  'gearshape.fill': '⚙',
  'arrow.clockwise': '↻',
  sparkles: '✦',
  'chevron.right': '›',
  'chevron.down': '▾',
};

/**
 * SF Symbols on iOS; simple glyph fallback on Android / web.
 * Navigation chrome only — not for content glyphs.
 */
export function SymbolIcon({
  name,
  size = 24,
  color,
  weight = 'regular',
}: {
  name: SFSymbol;
  size?: number;
  color: string;
  weight?: SymbolWeight;
}) {
  return (
    <SymbolView
      name={name}
      tintColor={color}
      type="monochrome"
      weight={weight}
      size={size}
      accessible={false}
      importantForAccessibility="no"
      fallback={
        <Text
          style={{ fontSize: size * 0.82, color, lineHeight: size }}
          accessible={false}
        >
          {fallbackGlyph[name] ?? '•'}
        </Text>
      }
    />
  );
}


