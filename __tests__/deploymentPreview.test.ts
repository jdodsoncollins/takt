import { describe, expect, it } from 'vitest';
import {
  absoluteDeploymentUrl,
  extractPreviewImageUrl,
  isUnusablePreviewLocation,
  shouldProbeDeploymentPreview,
} from '../src/domain/analysis/deploymentPreview';

describe('absoluteDeploymentUrl', () => {
  it('returns null for empty input', () => {
    expect(absoluteDeploymentUrl(null)).toBeNull();
    expect(absoluteDeploymentUrl('')).toBeNull();
    expect(absoluteDeploymentUrl('   ')).toBeNull();
  });

  it('adds https when the host has no scheme', () => {
    expect(absoluteDeploymentUrl('app.example.com')).toBe(
      'https://app.example.com',
    );
    expect(absoluteDeploymentUrl('//cdn.example.com/og.png')).toBe(
      'https://cdn.example.com/og.png',
    );
  });

  it('keeps an existing http(s) scheme', () => {
    expect(absoluteDeploymentUrl('https://app.example.com')).toBe(
      'https://app.example.com',
    );
    expect(absoluteDeploymentUrl('http://localhost:3000')).toBe(
      'http://localhost:3000',
    );
  });
});

describe('shouldProbeDeploymentPreview', () => {
  it('probes only READY deployments with a URL', () => {
    expect(shouldProbeDeploymentPreview('READY', 'app.example.com')).toBe(true);
    expect(shouldProbeDeploymentPreview('ERROR', 'app.example.com')).toBe(false);
    expect(shouldProbeDeploymentPreview('BUILDING', 'app.example.com')).toBe(
      false,
    );
    expect(shouldProbeDeploymentPreview('READY', null)).toBe(false);
    expect(
      shouldProbeDeploymentPreview('READY', 'https://vercel.com/login'),
    ).toBe(false);
  });
});

describe('isUnusablePreviewLocation', () => {
  it('rejects Vercel login and SSO walls', () => {
    expect(isUnusablePreviewLocation('https://vercel.com')).toBe(true);
    expect(isUnusablePreviewLocation('https://www.vercel.com/sso')).toBe(true);
    expect(
      isUnusablePreviewLocation(
        'https://app.example.com',
        'Vercel Login',
      ),
    ).toBe(true);
    expect(
      isUnusablePreviewLocation(
        'https://app.example.com',
        'Authentication Required',
      ),
    ).toBe(true);
  });

  it('allows the live deployment host', () => {
    expect(isUnusablePreviewLocation('https://www.example.com/')).toBe(
      false,
    );
    expect(
      isUnusablePreviewLocation('https://site-git-main-team.vercel.app'),
    ).toBe(false);
    expect(isUnusablePreviewLocation('not a url')).toBe(true);
  });
});

describe('extractPreviewImageUrl', () => {
  const page = 'https://app.example.com/docs';

  it('reads og:image with property first', () => {
    const html = `<meta property="og:image" content="https://cdn.example.com/og.png" />`;
    expect(extractPreviewImageUrl(html, page)).toBe(
      'https://cdn.example.com/og.png',
    );
  });

  it('reads og:image with content first', () => {
    const html = `<meta content="/og.png" property="og:image">`;
    expect(extractPreviewImageUrl(html, page)).toBe(
      'https://app.example.com/og.png',
    );
  });

  it('falls back to twitter:image then image_src', () => {
    expect(
      extractPreviewImageUrl(
        `<meta name="twitter:image" content="https://cdn.example.com/tw.jpg">`,
        page,
      ),
    ).toBe('https://cdn.example.com/tw.jpg');
    expect(
      extractPreviewImageUrl(
        `<link rel="image_src" href="//cdn.example.com/link.png">`,
        page,
      ),
    ).toBe('https://cdn.example.com/link.png');
  });

  it('returns null when no preview tag exists', () => {
    expect(extractPreviewImageUrl('<html><title>Hi</title></html>', page)).toBeNull();
  });
});
