import { describe, expect, it } from 'vitest';
import { ProjectSnapshotStore } from '../src/services/storage/projectSnapshotStore';
import { MemoryKeyValueStore } from '../src/services/storage/memoryKvStore';
import { deploymentID, projectID } from '../src/domain/models/ids';
import type { VercelProject } from '../src/domain/models/vercelModels';

const sample: VercelProject = {
  id: projectID('prj_1'),
  name: 'demo',
  framework: 'nextjs',
  nodeVersion: null,
  primaryDomain: null,
  productionDeployment: null,
  latestDeployment: null,
  lastSuccessfulDeployment: null,
  latestFailedDeployment: null,
  needsAttention: false,
  attentionReason: 'none',
  teamId: null,
};

describe('ProjectSnapshotStore', () => {
  it('saves and loads by team', async () => {
    const store = new ProjectSnapshotStore(new MemoryKeyValueStore());
    await store.save(null, [sample]);
    const loaded = await store.load(null);
    expect(loaded?.projects[0]?.name).toBe('demo');
    expect(loaded?.savedAt).toBeTruthy();
  });

  it('redacts deployment response content from snapshots', async () => {
    const kv = new MemoryKeyValueStore();
    const store = new ProjectSnapshotStore(kv);
    await store.save(null, [{
      ...sample,
      primaryDomain: 'private.example.com',
      latestDeployment: {
        id: deploymentID('dpl_1'),
        name: 'demo',
        url: 'https://private.example.com',
        state: 'ERROR',
        target: 'production',
        createdAt: 1,
        readyAt: null,
        buildingAt: null,
        source: 'raw-source',
        meta: { githubCommitMessage: 'sensitive commit text' },
        inspectorUrl: 'https://inspector.example.com',
        aliases: ['private.example.com'],
      },
    }]);
    const raw = await kv.getItem(`${ProjectSnapshotStore.keyPrefix}personal`);
    expect(raw).not.toContain('private.example.com');
    expect(raw).not.toContain('sensitive commit text');
    expect(raw).not.toContain('raw-source');
    expect(raw).toContain('ERROR');
    expect(raw).toContain('dpl_1');
  });

  it('clears every indexed account snapshot without a current team list', async () => {
    const kv = new MemoryKeyValueStore();
    const first = new ProjectSnapshotStore(kv);
    await first.save(null, [sample]);
    await first.save('team_old', [{ ...sample, teamId: 'team_old' as never }]);
    await first.save('team_new', [{ ...sample, teamId: 'team_new' as never }]);
    await kv.setItem(
      `${ProjectSnapshotStore.keyPrefix}legacy_unindexed`,
      JSON.stringify({ teamId: 'legacy_unindexed', savedAt: 'old', projects: [] }),
    );

    const rehydrated = new ProjectSnapshotStore(kv);
    await rehydrated.clearAll();

    expect(await rehydrated.load(null)).toBeNull();
    expect(await rehydrated.load('team_old')).toBeNull();
    expect(await rehydrated.load('team_new')).toBeNull();
    expect(await rehydrated.load('legacy_unindexed')).toBeNull();
    expect(await kv.getItem(ProjectSnapshotStore.indexKey)).toBeNull();
  });
});
