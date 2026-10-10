import { randomUUID } from "node:crypto";
import { mkdir, realpath } from "node:fs/promises";
import type { ConfigBackup } from "../../shared/config-backups";
import { archiveHash, canonicalPath } from "./archive-metadata";
import { contentVersion, readManagedFile, StorageConflict, writeManagedFile } from "./storage";

export interface ConfigBackupTarget {
  projectRoot: string;
  root: string;
  relative: string;
  key: string;
}
interface Snapshot extends ConfigBackup {
  source: string | null;
}
interface History {
  schemaVersion: 1;
  identity: string;
  snapshots: Snapshot[];
}

// A separate bounded history per project, content root and config key.
export class ConfigBackupStore {
  constructor(private stateDir: string) {}
  private async location(target: ConfigBackupTarget) {
    const identity = JSON.stringify([
      canonicalPath(await realpath(target.projectRoot)),
      canonicalPath(await realpath(target.root)),
      target.relative,
      target.key,
    ]);
    return { identity, relative: `config-backups/${archiveHash(identity)}.json` };
  }
  private async read(target: ConfigBackupTarget) {
    const location = await this.location(target);
    let file;
    try {
      file = await readManagedFile(this.stateDir, location.relative);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    let history: History = { schemaVersion: 1, identity: location.identity, snapshots: [] };
    if (file) {
      try {
        history = JSON.parse(file.content);
        if (
          history.schemaVersion !== 1 ||
          history.identity !== location.identity ||
          !Array.isArray(history.snapshots) ||
          history.snapshots.length > 5 ||
          new Set(history.snapshots.map((entry) => entry.id)).size !== history.snapshots.length ||
          history.snapshots.some(
            (entry) =>
              !/^[a-f0-9-]{36}$/.test(entry.id) ||
              !Number.isFinite(Date.parse(entry.createdAt)) ||
              (entry.source !== null && typeof entry.source !== "string") ||
              entry.targetExists !== (entry.source !== null) ||
              entry.version !== (entry.source === null ? "" : contentVersion(entry.source)),
          )
        )
          throw new Error();
      } catch {
        throw new StorageConflict("配置备份无法读取或校验，原有备份已保留。");
      }
    }
    return { ...location, history, version: file?.version ?? null };
  }
  async list(target: ConfigBackupTarget): Promise<ConfigBackup[]> {
    return (await this.read(target)).history.snapshots.map(({ source, ...summary }) => summary);
  }
  async get(target: ConfigBackupTarget, id: string) {
    const snapshot = (await this.read(target)).history.snapshots.find((entry) => entry.id === id);
    if (!snapshot) throw new StorageConflict("该配置备份已被替换或不属于当前配置，请刷新列表。");
    return snapshot;
  }
  async create(target: ConfigBackupTarget, source: string | null) {
    const current = await this.read(target);
    const snapshot: Snapshot = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      source,
      targetExists: source !== null,
      version: source === null ? "" : contentVersion(source),
    };
    const history: History = {
      ...current.history,
      snapshots: [snapshot, ...current.history.snapshots].slice(0, 5),
    };
    await mkdir(this.stateDir, { recursive: true });
    // Replace the history atomically; an unsuccessful write retains all existing backups.
    await writeManagedFile(
      this.stateDir,
      current.relative,
      JSON.stringify(history, null, 2) + "\n",
      current.version,
      null,
    );
    const { source: _, ...backup } = snapshot;
    return { backup, backups: history.snapshots.map(({ source: _, ...summary }) => summary) };
  }
}
