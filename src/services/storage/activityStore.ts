import type { ActivityItem } from '../../domain/models/vercelModels';
import type { KeyValueStore } from './kvStore';
import { MemoryKeyValueStore } from './memoryKvStore';

/** Device-local activity / audit log. Records real success and failure. */
export class ActivityStore {
  static readonly maxItems = 100;
  static readonly defaultKey = 'takt.recentActivity';

  private readonly storage: KeyValueStore;
  private readonly storageKey: string;
  private writes: Promise<void> = Promise.resolve();

  constructor(
    storage: KeyValueStore = new MemoryKeyValueStore(),
    storageKey: string = ActivityStore.defaultKey,
  ) {
    this.storage = storage;
    this.storageKey = storageKey;
  }

  async load(): Promise<ActivityItem[]> {
    await this.writes;
    const items = await this.loadNow();
    if (items.length > 0) await this.save(items);
    return items;
  }

  private async loadNow(): Promise<ActivityItem[]> {
    const raw = await this.storage.getItem(this.storageKey);
    if (!raw) return [];
    try {
      const decoded = JSON.parse(raw) as PersistedActivityItem[];
      if (!Array.isArray(decoded)) return [];
      return decoded.slice(0, ActivityStore.maxItems).map(fromPersistedActivity);
    } catch {
      return [];
    }
  }

  async save(items: ActivityItem[]): Promise<void> {
    await this.serialize(async () => this.saveNow(items));
  }

  async append(
    item: ActivityItem,
    _existing?: ActivityItem[],
  ): Promise<ActivityItem[]> {
    return this.serialize(async () => {
      const existing = await this.loadNow();
      const next = [item, ...existing].slice(0, ActivityStore.maxItems);
      await this.saveNow(next);
      return next;
    });
  }

  async clear(): Promise<void> {
    await this.serialize(async () => {
      await this.storage.removeItem(this.storageKey);
    });
  }

  private async saveNow(items: ActivityItem[]): Promise<void> {
    const persisted = items
      .slice(0, ActivityStore.maxItems)
      .map(toPersistedActivity);
    try {
      await this.storage.setItem(this.storageKey, JSON.stringify(persisted));
    } catch {
      // best-effort
    }
  }

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.writes.then(work, work);
    this.writes = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

interface PersistedActivityItem {
  id: string;
  kind: ActivityItem['kind'];
  outcome: ActivityItem['outcome'];
  createdAt: string;
  classification: string;
  projectId?: string | null;
  deploymentId?: string | null;
}

function toPersistedActivity(item: ActivityItem): PersistedActivityItem {
  return {
    id: item.id,
    kind: item.kind,
    outcome: item.outcome,
    createdAt: item.createdAt,
    classification: `${item.kind}:${item.outcome}`,
    projectId: item.projectId,
    deploymentId: item.deploymentId,
  };
}

function fromPersistedActivity(item: PersistedActivityItem): ActivityItem {
  const label = item.kind.replaceAll('_', ' ');
  return {
    id: item.id,
    kind: item.kind,
    title: label,
    detail: item.classification ?? `${item.kind}:${item.outcome}`,
    outcome: item.outcome,
    createdAt: item.createdAt,
    projectId: item.projectId,
    deploymentId: item.deploymentId,
  };
}
