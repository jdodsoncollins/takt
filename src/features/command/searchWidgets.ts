/**
 * Search is a results canvas, not a launcher.
 * Actions map to in-place widgets. Missing context swaps in picker widgets
 * (account / projects / deploys) instead of sending the user to another tab.
 */

export type SearchWidgetId =
  | 'brief'
  | 'deploys'
  | 'projects'
  | 'activity'
  | 'account'
  | 'incident'
  | 'env'
  | 'domain'
  | 'compare'
  | 'firewall'
  | 'flags'
  | 'runtime'
  | 'logs';

export type SearchWidgetContext = {
  connected: boolean;
  hasProject: boolean;
  hasDeployment: boolean;
};

const NEED_PROJECT: ReadonlySet<string> = new Set([
  'env',
  'domain',
  'firewall',
  'flags',
  'runtime',
  'deploys',
]);

const NEED_DEPLOYMENT: ReadonlySet<string> = new Set([
  'incident',
  'compare',
  'logs',
]);

export function resolveSearchWidgets(
  action: string,
  ctx: SearchWidgetContext,
): SearchWidgetId[] {
  if (!action || action === 'unknown' || action === 'answer') return [];
  if (action === 'settings') return ['account'];
  if (action === 'projects') return ctx.connected ? ['projects'] : ['account'];
  if (action === 'activity') return ['activity'];
  if (action === 'issues') return ['brief'];

  if (!ctx.connected) return ['account'];

  if (NEED_PROJECT.has(action) && !ctx.hasProject) return ['projects'];
  if (NEED_DEPLOYMENT.has(action) && !ctx.hasProject) return ['projects'];
  if (NEED_DEPLOYMENT.has(action) && !ctx.hasDeployment) return ['deploys'];

  if (action === 'deploys') return ['deploys'];
  if (action === 'env') return ['env'];
  if (action === 'domain') return ['domain'];
  if (action === 'firewall') return ['firewall'];
  if (action === 'flags') return ['flags'];
  if (action === 'runtime') return ['runtime'];
  if (action === 'incident') return ['incident'];
  if (action === 'compare') return ['compare'];
  if (action === 'logs') return ['logs'];
  return [];
}

export function searchNeedsFetch(
  action: string,
  widgets: SearchWidgetId[],
): boolean {
  if (action === 'issues') return widgets.includes('brief');
  if (action === 'settings' || action === 'projects' || action === 'activity') {
    return false;
  }
  if (action === 'deploys') return widgets.includes('deploys');
  return widgets.includes(action as SearchWidgetId);
}
