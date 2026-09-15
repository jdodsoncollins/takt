import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { OnDeviceBackend, OpsSynthesizerKind } from '../../domain/analysis/opsSynthesizer';
import { OPS_NARRATIVE_JSON_SCHEMA } from '../../domain/analysis/opsSynthesizer';

const SYSTEM_PROMPT =
  'You write short Vercel ops briefs from structured context. JSON only. Never output tokens, env values, or invented IDs.';

/**
 * OS built-in generation only.
 * iOS 26.4+: Apple Foundation Models (Apple Intelligence; AFM 3 Core on iOS 27).
 * Android 15+: Gemini Nano via ML Kit / AICore.
 * Never `setModel` / LiteRT-LM / GGUF — those are a separate small-model path.
 * Never Private Cloud Compute — privacy copy is on-device only.
 */
export function platformOnDeviceKind(): OnDeviceBackend['kind'] | null {
  if (Platform.OS === 'ios') return 'apple-foundation';
  if (Platform.OS === 'android') return 'gemini-nano';
  return null;
}

/** False when the installed binary was built without the ExpoAiKit pod. */
function nativeKitLinked(): boolean {
  try {
    return requireOptionalNativeModule('ExpoAiKit') != null;
  } catch {
    return false;
  }
}

export async function probeOnDeviceAvailable(): Promise<boolean> {
  if (!platformOnDeviceKind() || !nativeKitLinked()) return false;
  try {
    const kit = await import('expo-ai-kit');
    return await kit.isAvailable();
  } catch {
    return false;
  }
}

async function loadPreparedKit(): Promise<{
  kit: typeof import('expo-ai-kit');
  kind: OnDeviceBackend['kind'];
} | null> {
  const kind = platformOnDeviceKind();
  if (!kind || !nativeKitLinked()) return null;
  try {
    const kit = await import('expo-ai-kit');
    if (!(await kit.isAvailable())) return null;
    // Best OS-managed model on this device. No downloadable weights.
    await kit.prepareBuiltInModel();
    return { kit, kind };
  } catch {
    return null;
  }
}

export async function createOnDeviceBackend(): Promise<OnDeviceBackend | null> {
  const loaded = await loadPreparedKit();
  if (!loaded) return null;
  const { kit, kind } = loaded;

  const generateStructured: NonNullable<OnDeviceBackend['generateStructured']> =
    async (prompt, schema, systemPrompt) => {
      const result = await kit.generateObject(
        [{ role: 'user', content: prompt }],
        schema as Parameters<typeof kit.generateObject>[1],
        { systemPrompt, maxRepairAttempts: 1 },
      );
      return result.object ?? null;
    };

  return {
    kind,
    generate: async (prompt: string) =>
      generateStructured(prompt, OPS_NARRATIVE_JSON_SCHEMA, SYSTEM_PROMPT),
    generateStructured,
  };
}

export function describeSynthesizer(kind: OpsSynthesizerKind | undefined): string {
  switch (kind) {
    case 'apple-foundation':
      return 'Apple Intelligence (on-device)';
    case 'gemini-nano':
      return 'Gemini Nano (on-device)';
    case 'hybrid':
      return 'On-device + local heuristics';
    default:
      return 'Local heuristics';
  }
}

export function isOnDeviceSynthesizer(
  kind: OpsSynthesizerKind | undefined,
): boolean {
  return (
    kind === 'apple-foundation' ||
    kind === 'gemini-nano' ||
    kind === 'hybrid'
  );
}

/** One-line privacy copy. Null when this OS has no built-in model. */
export function onDevicePrivacyLine(
  kind: OnDeviceBackend['kind'] | null = platformOnDeviceKind(),
): string | null {
  if (kind === 'apple-foundation') {
    return 'All Apple Intelligence summaries and analysis are private and offline.';
  }
  if (kind === 'gemini-nano') {
    return 'Gemini Nano runs entirely on this device — private and offline.';
  }
  return null;
}
