import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import {
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';

/** Chrome uses clear glass so the system material can refract content behind it. */
export const chromeGlassEffectStyle = 'clear' as const;
export const chromeGlassColorScheme = 'auto' as const;

/**
 * True only when iOS can render native UIGlassEffect.
 * JS / Android / web stubs return false — use BlurView or opaque fallbacks.
 */
export function canUseNativeLiquidGlass(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/** iOS Reduce Transparency — skip glass and use opaque chrome. */
export function useReduceTransparency(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (typeof AccessibilityInfo.isReduceTransparencyEnabled !== 'function') {
      return;
    }
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setEnabled);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setEnabled,
    );
    return () => subscription.remove();
  }, []);

  return enabled;
}
