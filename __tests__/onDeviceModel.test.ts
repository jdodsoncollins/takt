import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

vi.mock('expo-ai-kit', () => ({
  isAvailable: async () => false,
  prepareBuiltInModel: async () => undefined,
  generateObject: async () => ({ object: null }),
}));

vi.mock('expo', () => ({
  requireOptionalNativeModule: () => null,
}));

import {
  createOnDeviceBackend,
  describeSynthesizer,
  isOnDeviceSynthesizer,
  onDevicePrivacyLine,
  platformOnDeviceKind,
  probeOnDeviceAvailable,
} from '../src/services/ai/onDeviceModel';

describe('onDeviceModel', () => {
  it('has no built-in model on web', () => {
    expect(platformOnDeviceKind()).toBeNull();
  });

  it('probes false when the platform has no Apple Intelligence / Gemini Nano', async () => {
    expect(await probeOnDeviceAvailable()).toBe(false);
  });

  it('returns null backend when the platform has no system model', async () => {
    expect(await createOnDeviceBackend()).toBeNull();
  });

  it('labels synthesizer sources for the UI', () => {
    expect(describeSynthesizer('apple-foundation')).toMatch(/Apple/i);
    expect(describeSynthesizer('gemini-nano')).toMatch(/Nano/i);
    expect(describeSynthesizer('hybrid')).toMatch(/heuristics/i);
    expect(describeSynthesizer('heuristic')).toMatch(/heuristics/i);
    expect(describeSynthesizer(undefined)).toMatch(/heuristics/i);
  });

  it('states that Apple Intelligence and Gemini Nano stay private and offline', () => {
    expect(onDevicePrivacyLine('apple-foundation')).toBe(
      'All Apple Intelligence summaries and analysis are private and offline.',
    );
    expect(onDevicePrivacyLine('gemini-nano')).toMatch(
      /Gemini Nano.*private and offline/i,
    );
    expect(onDevicePrivacyLine(null)).toBeNull();
  });

  it('treats only OS-model sources as on-device AI chrome', () => {
    expect(isOnDeviceSynthesizer('apple-foundation')).toBe(true);
    expect(isOnDeviceSynthesizer('gemini-nano')).toBe(true);
    expect(isOnDeviceSynthesizer('hybrid')).toBe(true);
    expect(isOnDeviceSynthesizer('heuristic')).toBe(false);
    expect(isOnDeviceSynthesizer(undefined)).toBe(false);
  });
});
