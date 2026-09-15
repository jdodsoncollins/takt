import { describe, expect, it } from 'vitest';
import {
  deploymentStateTone,
  outcomeTone,
} from '../src/design-system/consoleState';

describe('deploymentStateTone', () => {
  it('maps READY to ready', () => {
    expect(deploymentStateTone('READY')).toBe('ready');
  });
  it('maps build pipeline states to building', () => {
    expect(deploymentStateTone('BUILDING')).toBe('building');
    expect(deploymentStateTone('QUEUED')).toBe('building');
    expect(deploymentStateTone('INITIALIZING')).toBe('building');
  });
  it('maps failures to error', () => {
    expect(deploymentStateTone('ERROR')).toBe('error');
    expect(deploymentStateTone('CANCELED')).toBe('error');
    expect(deploymentStateTone('BLOCKED')).toBe('error');
  });
  it('maps unknown to neutral', () => {
    expect(deploymentStateTone('DELETED')).toBe('neutral');
  });
});

describe('outcomeTone', () => {
  it('maps activity outcomes', () => {
    expect(outcomeTone('success')).toBe('ready');
    expect(outcomeTone('failure')).toBe('error');
    expect(outcomeTone('info')).toBe('neutral');
  });
});
