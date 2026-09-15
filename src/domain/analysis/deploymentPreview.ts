import type { DeploymentState } from '../models/vercelModels';

/** Probe only READY URLs — error/building pages are Vercel chrome, not the site. */
export function shouldProbeDeploymentPreview(
  state: DeploymentState,
  url: string | null | undefined,
): boolean {
  const abs = absoluteDeploymentUrl(url);
  return state === 'READY' && abs != null && !isUnusablePreviewLocation(abs);
}

/** Vercel SSO / login walls — not the deployed site. */
export function isUnusablePreviewLocation(
  href: string,
  title = '',
): boolean {
  let host = '';
  let path = '';
  try {
    const parsed = new URL(href);
    host = parsed.hostname.toLowerCase();
    path = parsed.pathname.toLowerCase();
  } catch {
    return true;
  }
  if (host === 'vercel.com' || host === 'www.vercel.com') {
    return true;
  }
  if (
    path.includes('/login') ||
    path.includes('/sso') ||
    path.includes('/authentication')
  ) {
    if (host.endsWith('vercel.com')) return true;
  }
  const t = title.toLowerCase();
  if (t.includes('authentication required')) return true;
  if (t.includes('vercel') && (t.includes('login') || t.includes('sso'))) {
    return true;
  }
  return false;
}

export function absoluteDeploymentUrl(
  url: string | null | undefined,
): string | null {
  if (url == null) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/\//, '')}`;
}

const META_TAG = /<meta\b[^>]*>/gi;
const LINK_TAG = /<link\b[^>]*>/gi;
const ATTR = /([a-zA-Z:_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  ATTR.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR.exec(tag))) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

function resolveUrl(value: string, pageUrl: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    return new URL(raw, pageUrl).toString();
  } catch {
    return null;
  }
}

/**
 * First usable social/preview image from a page. Prefers og:image, then
 * twitter:image, then link rel=image_src. Callers should pass a truncated HTML
 * prefix — we do not need the full document.
 */
export function extractPreviewImageUrl(
  html: string,
  pageUrl: string,
): string | null {
  const slice = html.slice(0, 80_000);
  for (const tag of slice.match(META_TAG) ?? []) {
    const a = attrs(tag);
    const key = (a.property || a.name || '').toLowerCase();
    if (
      key === 'og:image' ||
      key === 'og:image:url' ||
      key === 'twitter:image' ||
      key === 'twitter:image:src'
    ) {
      const resolved = resolveUrl(a.content ?? '', pageUrl);
      if (resolved) return resolved;
    }
  }
  for (const tag of slice.match(LINK_TAG) ?? []) {
    const a = attrs(tag);
    const rel = (a.rel || '').toLowerCase();
    if (rel === 'image_src' || rel === 'apple-touch-icon') {
      const resolved = resolveUrl(a.href ?? '', pageUrl);
      if (resolved) return resolved;
    }
  }
  return null;
}
