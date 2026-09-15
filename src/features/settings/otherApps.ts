function extra(): Record<string, string | undefined> {
  try {
    const Constants = require('expo-constants').default as {
      expoConfig?: { extra?: Record<string, string | undefined> };
    };
    return Constants.expoConfig?.extra ?? {};
  } catch {
    return {};
  }
}

function read(key: string, envName: string): string | null {
  const value = extra()[key] || process.env[envName] || '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function privacyPolicyUrl(): string | null {
  return read('privacyPolicyUrl', 'EXPO_PUBLIC_PRIVACY_POLICY_URL');
}

export function otherAppStoreUrl(): string | null {
  return read('otherAppStoreUrl', 'EXPO_PUBLIC_OTHER_APP_STORE_URL');
}

export function otherAppName(): string | null {
  return read('otherAppName', 'EXPO_PUBLIC_OTHER_APP_NAME');
}

export function otherAppBlurb(): string | null {
  return read('otherAppBlurb', 'EXPO_PUBLIC_OTHER_APP_BLURB');
}
