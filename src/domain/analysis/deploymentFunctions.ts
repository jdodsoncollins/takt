import type { DataAvailability } from '../models/vercelModels';

export type DeploymentFunctionKind = 'lambda' | 'middleware' | 'edge';

export interface DeploymentFunction {
  id: string;
  route: string;
  kind: DeploymentFunctionKind;
  runtime: string | null;
  memoryMb: number | null;
  sizeBytes: number | null;
  readyState: string | null;
  hashed: boolean;
}

export type FunctionInventorySource =
  | 'file-tree'
  | 'lambda-output'
  | 'mixed'
  | 'none';

export interface DeploymentFileNode {
  name: string;
  type: string;
  uid?: string | null;
  size?: number | null;
  children?: DeploymentFileNode[];
}

export interface LambdaOutputRow {
  path: string;
  functionName: string;
  readyState: string | null;
}

export interface FunctionsInventoryInput {
  fileTree: DeploymentFileNode[] | null;
  fileTreeAvailable: boolean;
  lambdas: LambdaOutputRow[] | null;
  runtimeDefault?: string | null;
  memoryDefaultMb?: number | null;
}

export interface FunctionsInventoryReport {
  availability: DataAvailability;
  functions: DeploymentFunction[];
  source: FunctionInventorySource;
  note?: string;
}

const MAX_FUNCTIONS = 200;

export function formatNodeRuntime(nodeVersion: string | null | undefined): string | null {
  if (!nodeVersion) return null;
  const trimmed = nodeVersion.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/(\d+)/);
  if (!m) return trimmed;
  return `nodejs${m[1]}.x`;
}

export function formatFunctionSize(bytes: number | null): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function functionKindLabel(kind: DeploymentFunctionKind): string {
  if (kind === 'lambda') return 'Lambda';
  if (kind === 'middleware') return 'Middleware';
  return 'Edge';
}

export function looksHashedRoute(route: string): boolean {
  return /__fn_/i.test(route) || /[a-f0-9]{24,}/i.test(route);
}

export function buildFunctionsInventory(
  input: FunctionsInventoryInput,
): FunctionsInventoryReport {
  const fromTree = input.fileTreeAvailable
    ? collectFromFileTree(input.fileTree ?? [], input.runtimeDefault, input.memoryDefaultMb)
    : [];
  const fromLambdas = collectFromLambdas(
    input.lambdas ?? [],
    input.runtimeDefault,
    input.memoryDefaultMb,
  );

  const merged = mergeFunctions(fromTree, fromLambdas).slice(0, MAX_FUNCTIONS);
  const usedTree = fromTree.length > 0;
  const usedLambdas = fromLambdas.length > 0;
  const source: FunctionInventorySource = usedTree && usedLambdas
    ? 'mixed'
    : usedTree
      ? 'file-tree'
      : usedLambdas
        ? 'lambda-output'
        : 'none';

  if (merged.length === 0) {
    return {
      availability: 'no_data',
      functions: [],
      source: 'none',
      note: input.fileTreeAvailable
        ? 'No functions listed for this deployment.'
        : 'Function inventory not published for this build.',
    };
  }

  const allHashed = merged.every((fn) => fn.hashed);
  return {
    availability: 'ok',
    functions: merged,
    source,
    note: allHashed
      ? 'Route paths were not published for this build. Hashed output ids shown.'
      : undefined,
  };
}

function collectFromFileTree(
  nodes: DeploymentFileNode[],
  runtimeDefault: string | null | undefined,
  memoryDefaultMb: number | null | undefined,
): DeploymentFunction[] {
  const found: DeploymentFunction[] = [];
  walk(nodes, '', (node, path) => {
    const kind = kindFromType(node.type);
    if (!kind) return;
    const route = routeFromPath(path);
    found.push({
      id: node.uid ?? `${kind}:${route}`,
      route,
      kind,
      runtime: runtimeDefault ?? null,
      memoryMb: memoryDefaultMb ?? null,
      sizeBytes: typeof node.size === 'number' ? node.size : null,
      readyState: null,
      hashed: looksHashedRoute(route),
    });
  });
  return found;
}

function collectFromLambdas(
  rows: LambdaOutputRow[],
  runtimeDefault: string | null | undefined,
  memoryDefaultMb: number | null | undefined,
): DeploymentFunction[] {
  const found: DeploymentFunction[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const route = routeFromPath(row.path || row.functionName);
    const key = row.functionName || route;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    found.push({
      id: key,
      route,
      kind: 'lambda',
      runtime: runtimeDefault ?? null,
      memoryMb: memoryDefaultMb ?? null,
      sizeBytes: null,
      readyState: row.readyState,
      hashed: looksHashedRoute(route) || looksHashedRoute(row.functionName),
    });
  }
  return found;
}

function mergeFunctions(
  tree: DeploymentFunction[],
  lambdas: DeploymentFunction[],
): DeploymentFunction[] {
  if (tree.length === 0) return sortFunctions(lambdas);
  if (lambdas.length === 0) return sortFunctions(tree);
  const byRoute = new Map<string, DeploymentFunction>();
  for (const fn of lambdas) byRoute.set(fn.route, fn);
  for (const fn of tree) byRoute.set(fn.route, fn);
  return sortFunctions([...byRoute.values()]);
}

function sortFunctions(list: DeploymentFunction[]): DeploymentFunction[] {
  return [...list].sort((a, b) => {
    if (a.hashed !== b.hashed) return a.hashed ? 1 : -1;
    return a.route.localeCompare(b.route);
  });
}

function kindFromType(type: string): DeploymentFunctionKind | null {
  const t = type.toLowerCase();
  if (t === 'lambda') return 'lambda';
  if (t === 'middleware') return 'middleware';
  if (t === 'edge' || t === 'edge-function') return 'edge';
  return null;
}

function routeFromPath(path: string): string {
  const trimmed = path.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!trimmed) return '/';
  return `/${trimmed}`;
}

function walk(
  nodes: DeploymentFileNode[],
  prefix: string,
  visit: (node: DeploymentFileNode, path: string) => void,
): void {
  for (const node of nodes) {
    const name = node.name || '';
    const path = prefix ? `${prefix}/${name}` : name;
    visit(node, path);
    if (node.children?.length) walk(node.children, path, visit);
  }
}
