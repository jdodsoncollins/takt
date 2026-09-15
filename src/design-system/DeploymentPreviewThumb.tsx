import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useReduceMotion } from './GlassChrome';
import { colors, motion, radii } from './theme';

/** Portrait miniature of the live page. Slot stays reserved so the list does not shift. */
export function DeploymentPreviewThumb({
  imageUrl,
  variant,
}: {
  imageUrl: string | null;
  variant: 'banner' | 'chip' | 'detail';
}) {
  const reduceMotion = useReduceMotion();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl != null && failedUrl === imageUrl;
  const show = imageUrl != null && !failed;

  return (
    <View
      style={[styles.frame, styles[variant]]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {show ? (
        <>
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            contentPosition="top center"
            cachePolicy="memory-disk"
            recyclingKey={imageUrl}
            transition={reduceMotion ? 0 : motion.durationFast}
            onError={() => setFailedUrl(imageUrl)}
          />
          <View style={styles.scrim} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  banner: {
    alignSelf: 'center',
    width: 120,
    height: 228,
    borderRadius: radii.md,
  },
  chip: {
    width: 30,
    height: 48,
    borderRadius: radii.sm,
    flexShrink: 0,
  },
  detail: {
    alignSelf: 'center',
    width: 120,
    height: 228,
    borderRadius: radii.md,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8,7,6,0.12)',
  },
});
