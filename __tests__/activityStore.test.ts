import { describe, expect, it } from 'vitest';
import { ActivityStore } from '../src/services/storage/activityStore';
import { MemoryKeyValueStore } from '../src/services/storage/memoryKvStore';
import type { ActivityItem } from '../src/domain/models/vercelModels';

function item(id: string): ActivityItem {
  return {
    id,
    kind: 'note',
    title: 't',
    detail: 'd',
    outcome: 'info',
    createdAt: new Date().toISOString(),
  };
}

describe('ActivityStore', () => {
  it('persists and loads items', async () => {
    const kv = new MemoryKeyValueStore();
    const store = new ActivityStore(kv);
    const next = await store.append(item('1'), []);
    expect(next).toHaveLength(1);
    const loaded = await store.load();
    expect(loaded[0]?.id).toBe('1');
  });

  it('trims to maxItems', async () => {
    const kv = new MemoryKeyValueStore();
    const store = new ActivityStore(kv);
    let items: ActivityItem[] = [];
    for (let i = 0; i < ActivityStore.maxItems + 5; i++) {
      items = await store.append(item(String(i)), items);
    }
    expect(items.length).toBe(ActivityStore.maxItems);
  });

  it('serializes concurrent appends and persists classifications without raw detail', async () => {
    const kv = new MemoryKeyValueStore();
    const store = new ActivityStore(kv);
    const sensitive = { ...item('1'), title: 'API response', detail: 'secret raw log body' };
    await Promise.all([store.append(sensitive), store.append(item('2'))]);

    const loaded = await store.load();
    expect(loaded.map((entry) => entry.id).sort()).toEqual(['1', '2']);
    const raw = await kv.getItem(ActivityStore.defaultKey);
    expect(raw).not.toContain('secret raw log body');
    expect(raw).not.toContain('API response');
    expect(raw).toContain('note:info');
  });
});
