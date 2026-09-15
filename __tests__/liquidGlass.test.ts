import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  AccessibilityInfo: {
    addEventListener: () => ({ remove: () => undefined }),
  },
}));

vi.mock('expo-glass-effect', () => ({
  isGlassEffectAPIAvailable: () => false,
  isLiquidGlassAvailable: () => false,
}));

import {
  canUseNativeLiquidGlass,
  chromeGlassColorScheme,
  chromeGlassEffectStyle,
} from '../src/design-system/liquidGlass';

describe('canUseNativeLiquidGlass', () => {
  it('is false when the UIGlassEffect API is unavailable', () => {
    expect(canUseNativeLiquidGlass()).toBe(false);
  });
});

describe('chrome glass', () => {
  it('uses clear auto glass so chrome can refract the canvas', () => {
    expect(chromeGlassEffectStyle).toBe('clear');
    expect(chromeGlassColorScheme).toBe('auto');
  });
});
