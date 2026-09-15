import type { SFSymbol } from 'expo-symbols';

export function tabSymbol(name: SFSymbol, fill: SFSymbol, selected: boolean): SFSymbol {
  return selected ? fill : name;
}
