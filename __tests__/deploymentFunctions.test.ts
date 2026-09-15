import { describe, expect, it } from 'vitest';
import {
  buildFunctionsInventory,
  formatFunctionSize,
  formatNodeRuntime,
  functionKindLabel,
  looksHashedRoute,
} from '../src/domain/analysis/deploymentFunctions';

describe('buildFunctionsInventory', () => {
  it('uses file-tree lambda routes when published', () => {
    const report = buildFunctionsInventory({
      fileTreeAvailable: true,
      fileTree: [
        {
          name: 'index',
          type: 'lambda',
          uid: 'fn-index',
          size: 1_100_000,
        },
        {
          name: '_not-found.rsc',
          type: 'lambda',
          uid: 'fn-404',
          size: 1_050_000,
        },
        {
          name: 'middleware',
          type: 'middleware',
        },
        {
          name: 'app',
          type: 'directory',
          children: [{ name: 'page.js', type: 'file' }],
        },
      ],
      lambdas: [],
      runtimeDefault: 'nodejs24.x',
      memoryDefaultMb: 1024,
    });

    expect(report.availability).toBe('ok');
    expect(report.source).toBe('file-tree');
    expect(report.functions.map((f) => f.route)).toEqual([
      '/_not-found.rsc',
      '/index',
      '/middleware',
    ]);
    expect(report.functions[0]?.kind).toBe('lambda');
    expect(report.functions[0]?.runtime).toBe('nodejs24.x');
    expect(report.functions[0]?.memoryMb).toBe(1024);
    expect(report.functions.find((f) => f.route === '/middleware')?.kind).toBe(
      'middleware',
    );
  });

  it('falls back to hashed lambda output when the file tree is unpublished', () => {
    const report = buildFunctionsInventory({
      fileTreeAvailable: false,
      fileTree: null,
      lambdas: [
        {
          path: '__fn_team_abc-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa__',
          functionName: 'team_abc-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          readyState: 'READY',
        },
        {
          path: '__fn_team_abc-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa__',
          functionName: 'team_abc-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          readyState: 'READY',
        },
      ],
      runtimeDefault: 'nodejs24.x',
    });

    expect(report.availability).toBe('ok');
    expect(report.source).toBe('lambda-output');
    expect(report.functions).toHaveLength(1);
    expect(report.functions[0]?.hashed).toBe(true);
    expect(report.note).toMatch(/Hashed output ids/i);
  });

  it('uses an honest empty state when nothing is published', () => {
    const report = buildFunctionsInventory({
      fileTreeAvailable: false,
      fileTree: null,
      lambdas: [],
    });
    expect(report.availability).toBe('no_data');
    expect(report.source).toBe('none');
    expect(report.note).toMatch(/not published/i);
  });
});

describe('function helpers', () => {
  it('formats node versions and sizes', () => {
    expect(formatNodeRuntime('24.x')).toBe('nodejs24.x');
    expect(formatFunctionSize(1_050_000)).toBe('1.00 MB');
    expect(functionKindLabel('middleware')).toBe('Middleware');
    expect(looksHashedRoute('/index.rsc')).toBe(false);
    expect(looksHashedRoute('__fn_team_x')).toBe(true);
  });
});
