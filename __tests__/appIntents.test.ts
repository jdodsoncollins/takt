import { describe, expect, it } from 'vitest';
import {
  TAKT_APP_INTENT_PATHS,
  taktAppIntentUrl,
} from '../src/shell/appIntents';

describe('takt app intents', () => {
  it('opens existing screens over the custom scheme', () => {
    expect(taktAppIntentUrl('home')).toBe('takt://home');
    expect(taktAppIntentUrl('deployments')).toBe('takt://deployments');
    expect(taktAppIntentUrl('activity')).toBe('takt://activity');
    expect(taktAppIntentUrl('assistant')).toBe('takt://search');
    expect(taktAppIntentUrl('settings')).toBe('takt://settings');
  });

  it('does not expose mutators as intent paths', () => {
    const paths = Object.values(TAKT_APP_INTENT_PATHS).join(' ');
    expect(paths).not.toMatch(/redeploy|promote|rollback|delete/i);
  });
});
