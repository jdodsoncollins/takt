import type { ExpoConfig } from 'expo/config';

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

const name = env('EXPO_PUBLIC_APP_NAME') || 'Taktung';
const slug = env('EXPO_PUBLIC_SLUG') || 'takt';
const scheme = env('EXPO_PUBLIC_SCHEME') || 'takt';
const bundleId = env('EXPO_PUBLIC_BUNDLE_ID') || 'com.example.takt';
const androidPackage = env('EXPO_PUBLIC_ANDROID_PACKAGE') || bundleId;
const appleTeamId = env('EXPO_PUBLIC_APPLE_TEAM_ID');
const easProjectId = env('EXPO_PUBLIC_EAS_PROJECT_ID');
const easOwner = env('EXPO_PUBLIC_EAS_OWNER');

const config: ExpoConfig = {
  name,
  slug,
  version: '1.1.3',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  scheme,
  ios: {
    icon: {
      light: './assets/icon-light.png',
      dark: './assets/icon.png',
      tinted: './assets/icon-tinted.png',
    },
    supportsTablet: true,
    bundleIdentifier: bundleId,
    ...(appleTeamId ? { appleTeamId } : {}),
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: androidPackage,
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: '#0C0908',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: true,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  extra: {
    productConcept: 'Local-first Vercel operations assistant',
    oauthRedirectUri: env('EXPO_PUBLIC_OAUTH_REDIRECT_URI') || `${scheme}://oauth/callback`,
    vercelClientId: env('EXPO_PUBLIC_VERCEL_CLIENT_ID'),
    vercelOAuthScope: env('EXPO_PUBLIC_VERCEL_OAUTH_SCOPE') || 'offline_access',
    privacyPolicyUrl: env('EXPO_PUBLIC_PRIVACY_POLICY_URL'),
    supportUrl: env('EXPO_PUBLIC_SUPPORT_URL'),
    otherAppStoreUrl: env('EXPO_PUBLIC_OTHER_APP_STORE_URL'),
    otherAppName: env('EXPO_PUBLIC_OTHER_APP_NAME'),
    otherAppBlurb: env('EXPO_PUBLIC_OTHER_APP_BLURB'),
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
  experiments: {
    typedRoutes: true,
  },
  plugins: [
    'expo-router',
    [
      'expo-secure-store',
      {
        faceIDPermission: false,
      },
    ],
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#080706',
      },
    ],
    './plugins/withMinIosPodTarget.js',
    [
      'expo-ai-kit',
      {
        llm: true,
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '26.4',
        },
        android: {
          minSdkVersion: 35,
        },
      },
    ],
    'expo-font',
    './plugins/withAppIntents.js',
  ],
  ...(easOwner ? { owner: easOwner } : {}),
};

export default config;
