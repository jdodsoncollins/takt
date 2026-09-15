import Constants from 'expo-constants';

function extra(): Record<string, string | undefined> {
  return Constants.expoConfig?.extra ?? {};
}

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim() ?? '';
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

export function privacyPolicyUrl(): string | null {
  return firstNonEmpty(
    extra().privacyPolicyUrl,
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  );
}

export function otherAppStoreUrl(): string | null {
  return firstNonEmpty(
    extra().otherAppStoreUrl,
    process.env.EXPO_PUBLIC_OTHER_APP_STORE_URL,
  );
}

export function otherAppName(): string | null {
  return firstNonEmpty(
    extra().otherAppName,
    process.env.EXPO_PUBLIC_OTHER_APP_NAME,
  );
}

export function otherAppBlurb(): string | null {
  return firstNonEmpty(
    extra().otherAppBlurb,
    process.env.EXPO_PUBLIC_OTHER_APP_BLURB,
  );
}
