import type { VercelProject } from '../../domain/models/vercelModels';
import type { KeyValueStore } from './kvStore';
import { MemoryKeyValueStore } from './memoryKvStore';

export interface ProjectListSnapshot {
  teamId: string | null;
  savedAt: string;
  projects: VercelProject[];
}

/** Device-local project list cache for fast cold start + offline hint. */
export class ProjectSnapshotStore {
  static readonly keyPrefix = 'takt.projectSnapshot.';
  static readonly indexKey = 'takt.projectSnapshot.index';

  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly storage: KeyValueStore = new MemoryKeyValueStore()) {}

  private key(teamId: string | null): string {
    return ProjectSnapshotStore.keyPrefix + (teamId ?? 'personal');
  }

  async load(teamId: string | null): Promise<ProjectListSnapshot | null> {
    await this.writes;
    const raw = await this.storage.getItem(this.key(teamId));
    if (!raw) return null;
    try {
      const snapshot = JSON.parse(raw) as ProjectListSnapshot;
      if (snapshot.teamId !== teamId) return null;
      const sanitized = {
        ...snapshot,
        projects: snapshot.projects.map(redactProjectSnapshot),
      };
      await this.save(teamId, sanitized.projects);
      return sanitized;
    } catch {
      return null;
    }
  }

  async save(
    teamId: string | null,
    projects: VercelProject[],
  ): Promise<void> {
    await this.serialize(async () => {
      const snap: ProjectListSnapshot = {
        teamId,
        savedAt: new Date().toISOString(),
        projects: projects.map(redactProjectSnapshot),
      };
      try {
        const key = this.key(teamId);
        const keys = await this.loadIndex();
        keys.add(key);
        await this.saveIndex(keys);
        await this.storage.setItem(key, JSON.stringify(snap));
      } catch {
        // best-effort
      }
    });
  }

  async clear(teamId: string | null): Promise<void> {
    await this.serialize(async () => {
      const key = this.key(teamId);
      await this.storage.removeItem(key);
      const keys = await this.loadIndex();
      keys.delete(key);
      await this.saveIndex(keys);
    });
  }

  async clearAll(): Promise<void> {
    await this.serialize(async () => {
      const keys = await this.loadIndex();
      for (const key of await this.storage.getAllKeys()) {
        if (
          key.startsWith(ProjectSnapshotStore.keyPrefix) &&
          key !== ProjectSnapshotStore.indexKey
        ) {
          keys.add(key);
        }
      }
      keys.add(this.key(null));
      await Promise.all([...keys].map((key) => this.storage.removeItem(key)));
      await this.storage.removeItem(ProjectSnapshotStore.indexKey);
    });
  }

  private async loadIndex(): Promise<Set<string>> {
    const raw = await this.storage.getItem(ProjectSnapshotStore.indexKey);
    if (!raw) return new Set();
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return new Set();
      return new Set(
        parsed.filter(
          (key): key is string =>
            typeof key === 'string' && key.startsWith(ProjectSnapshotStore.keyPrefix),
        ),
      );
    } catch {
      return new Set();
    }
  }

  private async saveIndex(keys: Set<string>): Promise<void> {
    if (keys.size === 0) {
      await this.storage.removeItem(ProjectSnapshotStore.indexKey);
      return;
    }
    await this.storage.setItem(
      ProjectSnapshotStore.indexKey,
      JSON.stringify([...keys].sort()),
    );
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

function redactProjectSnapshot(project: VercelProject): VercelProject {
  const redactDeployment = (
    deployment: VercelProject['latestDeployment'],
  ): VercelProject['latestDeployment'] =>
    deployment
      ? {
          ...deployment,
          url: null,
          source: null,
          creatorUsername: null,
          isRollbackCandidate: null,
          region: null,
          meta: {},
          inspectorUrl: null,
          aliases: [],
        }
      : null;

  return {
    ...project,
    primaryDomain: null,
    productionDeployment: redactDeployment(project.productionDeployment),
    latestDeployment: redactDeployment(project.latestDeployment),
    lastSuccessfulDeployment: redactDeployment(project.lastSuccessfulDeployment),
    latestFailedDeployment: redactDeployment(project.latestFailedDeployment),
    link: null,
  };
}
