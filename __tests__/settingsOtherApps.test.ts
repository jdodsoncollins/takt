import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: {} } },
}));

import {
  otherAppBlurb,
  otherAppName,
  otherAppStoreUrl,
  privacyPolicyUrl,
} from '../src/features/settings/otherApps';

describe('optional Settings links', () => {
  it('hides privacy and other-app rows when env is unset', () => {
    expect(privacyPolicyUrl()).toBeNull();
    expect(otherAppStoreUrl()).toBeNull();
    expect(otherAppName()).toBeNull();
    expect(otherAppBlurb()).toBeNull();
  });
});
