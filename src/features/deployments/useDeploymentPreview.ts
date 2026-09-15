import { useEffect, useState } from 'react';
import {
  absoluteDeploymentUrl,
  shouldProbeDeploymentPreview,
} from '../../domain/analysis/deploymentPreview';
import {
  getCachedPreviewImageUrl,
  probePreviewImageUrl,
} from '../../services/preview/deploymentPreviewClient';
import type { DeploymentState } from '../../domain/models/vercelModels';

export function useDeploymentPreview(
  url: string | null | undefined,
  state: DeploymentState,
): string | null {
  const pageUrl = absoluteDeploymentUrl(url);
  const enabled = shouldProbeDeploymentPreview(state, url);
  const [imageUrl, setImageUrl] = useState<string | null>(() => {
    if (!pageUrl || !enabled) return null;
    return getCachedPreviewImageUrl(pageUrl) ?? null;
  });

  useEffect(() => {
    if (!enabled || !pageUrl) {
      setImageUrl(null);
      return;
    }
    const cached = getCachedPreviewImageUrl(pageUrl);
    if (cached !== undefined) {
      setImageUrl(cached);
      return;
    }
    let alive = true;
    void probePreviewImageUrl(pageUrl).then((next) => {
      if (alive) setImageUrl(next);
    });
    return () => {
      alive = false;
    };
  }, [enabled, pageUrl]);

  return imageUrl;
}
