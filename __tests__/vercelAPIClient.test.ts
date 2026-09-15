import { describe, expect, it, vi } from 'vitest';
import {
  readRuntimeLogStream,
  VercelAPIClientImpl,
} from '../src/services/api/vercelAPIClient';
import { VercelAPIError } from '../src/services/api/errors';
import { deploymentID, projectID } from '../src/domain/models/ids';

describe('VercelAPIClientImpl', () => {
  it('maps unauthorized 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      text: async () => 'nope',
    });
    const client = new VercelAPIClientImpl({
      tokenProvider: async () => 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const error = await client.getUser().catch((caught) => caught);
    expect(error).toBeInstanceOf(VercelAPIError);
    expect(error.message).not.toContain('nope');
  });

  it('paginates projects using the documented v10 continuation token', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          projects: [{ id: 'prj_1', name: 'one' }],
          pagination: { next: 'next-page' },
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          projects: [{ id: 'prj_2', name: 'two' }],
          pagination: { next: null },
        }),
      });
    const client = new VercelAPIClientImpl({
      tokenProvider: async () => 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const projects = await client.listProjects(null);
    expect(projects.map((project) => project.id).sort()).toEqual([
      'prj_1',
      'prj_2',
    ]);
    expect(fetchImpl.mock.calls[0]?.[0]).toContain('/v10/projects?');
    expect(fetchImpl.mock.calls[1]?.[0]).toContain('from=next-page');
  });

  it('fails closed without probing undocumented analytics or flags endpoints', async () => {
    const fetchImpl = vi.fn();
    const client = new VercelAPIClientImpl({
      tokenProvider: async () => 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(client.fetchObservability(projectID('prj_1'), null)).resolves.toMatchObject({
      kind: 'temporarily_unavailable',
    });
    await expect(client.listFeatureFlags(projectID('prj_1'), null)).resolves.toMatchObject({
      availability: 'temporarily_unavailable',
      flags: null,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses the firewall events contract and aggregates action counts', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        actions: [
          { action_type: 'deny', count: 4, host: 'blocked.example' },
          { action_type: 'challenge', count: 2, host: 'challenge.example' },
        ],
      }),
    });
    const client = new VercelAPIClientImpl({
      tokenProvider: async () => 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await client.fetchFirewallStats(projectID('prj_1'), null);
    expect(fetchImpl.mock.calls[0]?.[0]).toContain('/v1/security/firewall/events?');
    expect(result.current).toMatchObject({ denied: 4, challenged: 2 });
  });

  it('parses the documented runtime-log NDJSON stream without invented filters', async () => {
    const body = `${JSON.stringify({
      rowId: 'row_1',
      level: 'error',
      message: 'failed',
      requestPath: '/api/test',
      responseStatusCode: 500,
      timestampInMs: 1_700_000_000_000,
      source: 'serverless',
    })}\n`;
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/stream+json' },
      }),
    );
    const client = new VercelAPIClientImpl({
      tokenProvider: async () => 'tok',
      fetchImpl,
    });
    const report = await client.queryRuntimeLogs(
      projectID('prj_1'),
      deploymentID('dpl_1'),
      null,
      {
        environment: 'production',
        sinceMs: 1_600_000_000_000,
        untilMs: null,
        statusClass: '5xx',
        levels: ['error'],
        pathContains: null,
        limit: 10,
        label: 'errors',
      },
    );
    const requestedUrl = String(fetchImpl.mock.calls[0]?.[0]);
    expect(requestedUrl).not.toContain('since=');
    expect(requestedUrl).not.toContain('until=');
    expect(report.entries[0]).toMatchObject({
      id: 'row_1',
      statusCode: 500,
      path: '/api/test',
    });
  });

  it('rejects oversized runtime-log lines', async () => {
    const response = new Response(
      `${JSON.stringify({ message: 'x'.repeat(70 * 1024) })}\n`,
      { headers: { 'Content-Type': 'application/stream+json' } },
    );
    await expect(readRuntimeLogStream(response)).rejects.toThrow(
      'line exceeds byte limit',
    );
  });

  it('strips env values from listEnvVarMeta', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        envs: [
          {
            id: 'env_1',
            key: 'SECRET',
            type: 'encrypted',
            target: ['production'],
            value: 'super-secret-should-not-leak',
          },
        ],
      }),
    });
    const client = new VercelAPIClientImpl({
      tokenProvider: async () => 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const envs = await client.listEnvVarMeta(projectID('prj_1'), null);
    expect(envs).toHaveLength(1);
    expect(envs[0]?.key).toBe('SECRET');
    expect(JSON.stringify(envs)).not.toContain('super-secret');
  });

  it('maps deployment list payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        deployments: [
          {
            uid: 'dpl_abc',
            name: 'app',
            readyState: 'READY',
            target: 'production',
            created: 1_700_000_000_000,
            url: 'app.vercel.app',
            source: 'git',
            isRollbackCandidate: true,
            regions: ['iad1'],
            creator: {
              uid: 'user_1',
              username: 'jane',
              email: 'secret-should-not-leak@example.com',
            },
            meta: {
              githubCommitSha: '5571c7e9aedabbd14da0111bc399ddcf077d18a2',
              githubCommitRef: 'master',
              githubCommitMessage: 'Add uniquely named Modern sit plates.',
              githubCommitAuthorName: 'Jane Example',
              githubCommitAuthorLogin: 'jane',
              githubCommitAuthorEmail: 'secret-should-not-leak@example.com',
            },
          },
        ],
      }),
    });
    const client = new VercelAPIClientImpl({
      tokenProvider: async () => 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const list = await client.listDeployments(projectID('prj_1'), null);
    expect(list[0]?.id).toBe('dpl_abc');
    expect(list[0]?.state).toBe('READY');
    expect(list[0]?.url).toContain('https://');
    expect(list[0]?.source).toBe('git');
    expect(list[0]?.creatorUsername).toBe('jane');
    expect(list[0]?.isRollbackCandidate).toBe(true);
    expect(list[0]?.region).toBe('iad1');
    expect(list[0]?.meta.githubCommitAuthorLogin).toBe('jane');
    expect(JSON.stringify(list)).not.toContain('secret-should-not-leak');
  });

  it('pins a redeploy to the confirmed project in the exact request body', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            uid: 'dpl_source',
            name: 'app',
            readyState: 'READY',
            created: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            uid: 'dpl_new',
            name: 'app',
            readyState: 'BUILDING',
            created: 2,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    const client = new VercelAPIClientImpl({
      tokenProvider: async () => 'tok',
      fetchImpl,
    });

    await client.redeploy(
      deploymentID('dpl_source'),
      projectID('prj_confirmed'),
      null,
      { target: 'production' },
    );

    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        name: 'app',
        project: 'prj_confirmed',
        deploymentId: 'dpl_source',
        meta: { action: 'redeploy', sourceDeploymentId: 'dpl_source' },
        target: 'production',
      }),
    });
  });

  it('maps aliases and lambda outputs on deployment detail', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        uid: 'dpl_1',
        name: 'site',
        readyState: 'READY',
        created: 1,
        alias: ['www.example.com', 'site.vercel.app'],
        lambdas: [
          {
            readyState: 'READY',
            output: [
              { path: '/index', functionName: 'index' },
              { path: '/index', functionName: 'index' },
            ],
          },
        ],
      }),
    });
    const client = new VercelAPIClientImpl({
      tokenProvider: async () => 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const d = await client.getDeployment(deploymentID('dpl_1'), null);
    expect(d.aliases).toEqual(['www.example.com', 'site.vercel.app']);
    expect(d.lambdaOutputs).toEqual([
      { path: '/index', functionName: 'index', readyState: 'READY' },
    ]);
  });

  it('treats a missing file tree as an honest functions empty when no lambdas', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
    });
    const client = new VercelAPIClientImpl({
      tokenProvider: async () => 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const report = await client.fetchDeploymentFunctions(
      deploymentID('dpl_1'),
      null,
      { lambdaOutputs: [] },
    );
    expect(report.availability).toBe('no_data');
    expect(report.note).toMatch(/not published/i);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      '/v6/deployments/dpl_1/files',
    );
  });

  it('reads function routes from the published file tree', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [
        { name: 'index.rsc', type: 'lambda', uid: 'a', size: 1000 },
      ],
    });
    const client = new VercelAPIClientImpl({
      tokenProvider: async () => 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const report = await client.fetchDeploymentFunctions(
      deploymentID('dpl_1'),
      null,
      { lambdaOutputs: [], nodeVersion: '24.x' },
    );
    expect(report.availability).toBe('ok');
    expect(report.functions[0]?.route).toBe('/index.rsc');
    expect(report.functions[0]?.runtime).toBe('nodejs24.x');
  });
});
