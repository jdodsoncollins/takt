import { Platform } from 'react-native';
import {
  absoluteDeploymentUrl,
  extractPreviewImageUrl,
  isUnusablePreviewLocation,
} from '../../domain/analysis/deploymentPreview';
import { enqueuePreviewCapture } from './previewCaptureQueue';

export const PREVIEW_PROBE_MS = 1_400;
export const PREVIEW_HTML_CHARS = 80_000;

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

/** Session cache: `undefined` = not probed, `null` = miss. */
export function getCachedPreviewImageUrl(
  pageUrl: string,
): string | null | undefined {
  if (!cache.has(pageUrl)) return undefined;
  return cache.get(pageUrl);
}

export function rememberPreviewCapture(
  pageUrl: string,
  uri: string | null,
): void {
  cache.set(pageUrl, uri);
}

export function probePreviewImageUrl(
  pageUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const abs = absoluteDeploymentUrl(pageUrl);
  if (!abs || isUnusablePreviewLocation(abs)) return Promise.resolve(null);
  const cached = getCachedPreviewImageUrl(abs);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = inflight.get(abs);
  if (existing) return existing;
  const run = (
    Platform.OS === 'web'
      ? fetchOgImageUrl(abs, signal)
      : enqueuePreviewCapture(abs, signal)
  ).finally(() => {
    inflight.delete(abs);
  });
  inflight.set(abs, run);
  return run;
}

/** Web-only fallback. Native uses a WebView snapshot of the painted page. */
async function fetchOgImageUrl(
  pageUrl: string,
  outer?: AbortSignal,
): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PREVIEW_PROBE_MS);
  const onOuterAbort = () => ctrl.abort();
  outer?.addEventListener('abort', onOuterAbort);
  try {
    const res = await fetch(pageUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml,image/*,*/*;q=0.1',
      },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      cache.set(pageUrl, null);
      return null;
    }
    const type = (res.headers.get('content-type') ?? '').toLowerCase();
    if (type.startsWith('image/')) {
      cache.set(pageUrl, pageUrl);
      return pageUrl;
    }
    if (!type.includes('html') && type.length > 0) {
      cache.set(pageUrl, null);
      return null;
    }
    const html = (await res.text()).slice(0, PREVIEW_HTML_CHARS);
    const image = extractPreviewImageUrl(html, pageUrl);
    cache.set(pageUrl, image);
    return image;
  } catch {
    if (outer?.aborted) return null;
    cache.set(pageUrl, null);
    return null;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuterAbort);
  }
}
