import { describe, expect, it } from 'vitest';
import {
  resolveSearchWidgets,
  searchNeedsFetch,
} from '../src/features/command/searchWidgets';

const connected = {
  connected: true,
  hasProject: true,
  hasDeployment: true,
};

describe('resolveSearchWidgets', () => {
  it('keeps results in Search — no tab targets', () => {
    const actions = [
      'deploys',
      'projects',
      'activity',
      'settings',
      'issues',
      'env',
    ];
    for (const action of actions) {
      const widgets = resolveSearchWidgets(action, connected);
      expect(widgets.join(',')).not.toMatch(/home|tab|settings-sheet/i);
      expect(widgets.length).toBeGreaterThan(0);
    }
  });

  it('maps deploys / projects / activity / settings to in-place widgets', () => {
    expect(resolveSearchWidgets('deploys', connected)).toEqual(['deploys']);
    expect(resolveSearchWidgets('projects', connected)).toEqual(['projects']);
    expect(resolveSearchWidgets('activity', connected)).toEqual(['activity']);
    expect(resolveSearchWidgets('settings', connected)).toEqual(['account']);
  });

  it('asks for a project instead of sending the user to Home', () => {
    expect(
      resolveSearchWidgets('env', {
        connected: true,
        hasProject: false,
        hasDeployment: false,
      }),
    ).toEqual(['projects']);
    expect(
      resolveSearchWidgets('deploys', {
        connected: true,
        hasProject: false,
        hasDeployment: false,
      }),
    ).toEqual(['projects']);
  });

  it('asks for a deployment instead of opening the Deployments tab', () => {
    expect(
      resolveSearchWidgets('incident', {
        connected: true,
        hasProject: true,
        hasDeployment: false,
      }),
    ).toEqual(['deploys']);
  });

  it('shows account when disconnected, not a tab switch', () => {
    const offline = {
      connected: false,
      hasProject: false,
      hasDeployment: false,
    };
    expect(resolveSearchWidgets('deploys', offline)).toEqual(['account']);
    expect(resolveSearchWidgets('projects', offline)).toEqual(['account']);
    expect(resolveSearchWidgets('settings', offline)).toEqual(['account']);
  });

  it('does not fetch until the required picker is satisfied', () => {
    expect(
      searchNeedsFetch(
        'env',
        resolveSearchWidgets('env', {
          connected: true,
          hasProject: false,
          hasDeployment: false,
        }),
      ),
    ).toBe(false);
    expect(searchNeedsFetch('env', ['env'])).toBe(true);
    expect(searchNeedsFetch('issues', ['brief'])).toBe(true);
    expect(searchNeedsFetch('deploys', ['deploys'])).toBe(true);
    expect(searchNeedsFetch('answer', [])).toBe(false);
  });
});
