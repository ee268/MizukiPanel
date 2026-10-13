import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  cp,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import type { ArchiveInventory, ArchiveItem, MaintenancePreview } from "../../shared/maintenance";
import {
  parseSettings,
  record,
  SettingsValidationError,
  patchSettings,
  emptyDocument,
} from "../../shared/panel-settings";
import {
  archiveHash,
  archiveSnapshot,
  canonicalPath,
  type ArchiveMetadata,
} from "./archive-metadata";
import { assertManagedRealPath, resolveManagedPath } from "./path-guard";
import { contentVersion, StorageConflict, writeManagedFile } from "./storage";
import { readPanelSettings, savePanelSettingsGroups, settingsProjectKey } from "./panel-settings";
import type { ProjectReport } from "./project";
import { CONFIGS } from "./configs";
import { FEATURE_DATA } from "./features";
import { createArticleFromSource, saveArticleSource, validateArticleCreation } from "./articles";
import { workspacePreviewTask } from "./preview";
import { workspacePublishTask } from "./publish";
import { RECYCLE_DIRECTORY, RECYCLE_CATEGORIES } from "./recycle-bin";
import { AiVault, aiVault, aiVaultFileName } from "./ai-vault";
import {
  assertConversationRecoveryAvailable,
  restoreArticleConversations,
  validateArticleBundle,
} from "./article-conversation-recovery";

export class MaintenanceError extends Error {}
interface Entry {
  item: ArchiveItem;
  payload: string;
  metadata: ArchiveMetadata | null;
  fingerprint: string;
}
interface Lease {
  kind: "restore" | "cleanup";
  expires: number;
  version: string;
  projectKey: string | null;
  ids: string[];
  targetVersion?: string | null;
  policyVersion?: string | null;
}

function metadataOf(raw: string, kind: "backup" | "trash"): ArchiveMetadata {
  const value: unknown = JSON.parse(raw);
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    value.kind !== kind ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.root !== "string" ||
    !path.isAbsolute(value.root) ||
    typeof value.relative !== "string" ||
    typeof value.digest !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.digest) ||
    typeof value.bytes !== "number" ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes < 0 ||
    typeof value.directory !== "boolean" ||
    (value.articleBundle !== undefined &&
      (value.articleBundle !== true ||
        value.domain !== "article" ||
        kind !== "trash" ||
        !value.directory)) ||
    !(
      value.projectKey === null ||
      (typeof value.projectKey === "string" && /^[a-f0-9]{64}$/.test(value.projectKey))
    ) ||
    !["article", "config", "feature", "media", "settings", "workspace"].includes(
      String(value.domain),
    )
  )
    throw new MaintenanceError("恢复元数据无效。");
  resolveManagedPath(value.root, value.relative);
  return value as unknown as ArchiveMetadata;
}
function resourceKey(metadata: ArchiveMetadata) {
  return JSON.stringify([
    metadata.projectKey,
    canonicalPath(metadata.root),
    metadata.relative,
    metadata.kind,
  ]);
}
function runningRoot(root: string | undefined) {
  if (!root) return false;
  return [workspacePreviewTask(), workspacePublishTask()].some(
    (task) => task && canonicalPath(task.projectRoot) === canonicalPath(root),
  );
}
function runningArchive(metadata: ArchiveMetadata) {
  return (
    runningRoot(metadata.projectRoot) ||
    (metadata.projectKey !== null &&
      [workspacePreviewTask(), workspacePublishTask()].some(
        (task) => task && archiveHash(canonicalPath(task.projectRoot)) === metadata.projectKey,
      ))
  );
}

export class MaintenanceStore {
  private leases = new Map<string, Lease>();
  constructor(
    private stateDir: string,
    private now: () => number = Date.now,
  ) {}
  private async safe(relative: string) {
    const filename = await assertManagedRealPath(this.stateDir, relative);
    const root = await realpath(this.stateDir);
    let current = root;
    for (const part of path.relative(root, filename).split(path.sep)) {
      current = path.join(current, part);
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) throw new MaintenanceError("恢复目录包含链接，不能操作。");
    }
    return filename;
  }
  private async target(metadata: ArchiveMetadata, report: ProjectReport | null) {
    if (metadata.domain === "workspace")
      throw new MaintenanceError("工作区历史需通过工作区页面重新关联，不能直接恢复。");
    if (metadata.domain === "settings") {
      if (canonicalPath(metadata.root) !== canonicalPath(await realpath(this.stateDir)))
        throw new MaintenanceError("设置来自其他面板目录。");
      const key = report ? await settingsProjectKey(report.root) : null;
      if (
        !(
          ["settings.json", "personal-settings.json", `secure/${aiVaultFileName}`].includes(
            metadata.relative,
          ) &&
          metadata.projectKey === null &&
          !metadata.directory
        ) &&
        !(
          key &&
          metadata.projectKey === key &&
          metadata.relative === `project-settings/${key}.json`
        )
      )
        throw new MaintenanceError("请连接该备份所属项目后恢复。");
      return assertManagedRealPath(this.stateDir, metadata.relative);
    }
    if (!report || metadata.projectKey !== (await settingsProjectKey(report.root)))
      throw new MaintenanceError("请连接该恢复点所属项目。");
    if (report.readOnly || report.mode === "blocked")
      throw new MaintenanceError("当前项目只读，不能恢复内容。");
    if (runningRoot(report.root))
      throw new MaintenanceError("该项目仍有运行任务，请结束任务后恢复。");
    const root = await realpath(report.contentRoot ?? report.root);
    if (canonicalPath(metadata.root) !== canonicalPath(root))
      throw new MaintenanceError("内容根目录已改变，不能恢复到新的目录。");
    const local = report.mode !== "external";
    const r = metadata.relative;
    let allowed = false;
    if (metadata.domain === "article")
      allowed =
        r.startsWith(local ? "src/content/posts/" : "posts/") &&
        /\.(md|mdx)$/.test(r) &&
        (!metadata.directory || metadata.articleBundle === true);
    if (metadata.domain === "config")
      allowed =
        CONFIGS.some(
          (item) => r === (local ? `src/config/${item.file}` : `overrides/${item.key}.ts`),
        ) && !metadata.directory;
    if (metadata.domain === "feature") {
      const data = local ? "src/data" : "data";
      const spec = local ? "src/content/spec" : "spec";
      const anime = local ? "src/content/animes" : "animes";
      const albums = local ? "public/images/albums" : "images/albums";
      allowed =
        FEATURE_DATA.some((item) => r === `${data}/${item.file}`) ||
        ["about.md", "friends.md"].some((file) => r === `${spec}/${file}`) ||
        new RegExp(`^${anime}/\\d{4}/(1|4|7|10)月\\.md$`).test(r) ||
        new RegExp(
          `^${albums}/[A-Za-z0-9][A-Za-z0-9_-]{0,63}${metadata.directory ? "" : "/info\\.json"}$`,
        ).test(r);
      if (metadata.directory && metadata.kind !== "trash") allowed = false;
      if (metadata.directory)
        allowed =
          metadata.kind === "trash" &&
          new RegExp(`^${albums}/[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`).test(r);
    }
    if (metadata.domain === "media")
      allowed =
        metadata.kind === "trash" &&
        !metadata.directory &&
        /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(r) &&
        (r.startsWith(local ? "public/images/" : "images/") ||
          r.startsWith(local ? "src/content/posts/" : "posts/"));
    if (!allowed) throw new MaintenanceError("原路径不在当前可恢复的资源范围中。");
    const target = await assertManagedRealPath(root, r);
    // Reject even in-root aliases so a later move cannot redirect a recovery write.
    let ancestor = path.dirname(target);
    while (canonicalPath(ancestor) !== canonicalPath(root)) {
      try {
        if ((await lstat(ancestor)).isSymbolicLink())
          throw new MaintenanceError("原路径包含链接，不能恢复。");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      ancestor = path.dirname(ancestor);
    }
    return target;
  }
  private async targetVersion(filename: string): Promise<string | null> {
    try {
      const stat = await lstat(filename);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new MaintenanceError("原路径已被目录、链接或特殊文件占用。");
      return contentVersion(await readFile(filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  private async entries(
    report: ProjectReport | null,
  ): Promise<{ entries: Entry[]; warnings: string[] }> {
    const paths: { relative: string; kind: "backup" | "trash" }[] = [];
    const warnings: string[] = [];
    const walk = async (relative: string, kind: "backup" | "trash", depth: number) => {
      let names;
      try {
        names = await readdir(await this.safe(relative), { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        warnings.push(`${relative}：${(error as Error).message}`);
        return;
      }
      const recordedNames = new Set(names.map((name) => name.name));
      for (const name of names.sort((a, b) => a.name.localeCompare(b.name))) {
        if (paths.length >= 2000)
          throw new MaintenanceError("恢复项超过 2000 个，请先在状态目录中手动归档。");
        const nested = `${relative}/${name.name}`;
        if (name.isSymbolicLink()) {
          warnings.push(`${nested} 为链接，已跳过。`);
          continue;
        }
        if (name.name.endsWith(".meta.json")) continue;
        if (
          kind === "trash" &&
          depth === 0 &&
          (!name.isDirectory() ||
            !RECYCLE_CATEGORIES.includes(name.name as (typeof RECYCLE_CATEGORIES)[number]))
        ) {
          warnings.push(`${nested} 不属于回收站分类，未计入统计。`);
          continue;
        }
        if (kind === "trash" && depth > 0 && !recordedNames.has(name.name + ".meta.json")) {
          warnings.push(`${nested} 缺少回收记录，未计入统计。`);
          continue;
        }
        if (name.isDirectory() && (kind === "backup" || depth === 0)) {
          if (depth >= 4) {
            warnings.push(`${nested} 超过目录扫描深度，已保留。`);
            continue;
          }
          await walk(nested, kind, depth + 1);
        } else if (name.isDirectory() || name.isFile()) paths.push({ relative: nested, kind });
      }
    };
    await walk("backups", "backup", 0);
    await walk(RECYCLE_DIRECTORY, "trash", 0);
    const entries: Entry[] = [];
    for (const { relative, kind } of paths) {
      const payload = await this.safe(relative);
      const stat = await lstat(payload);
      let metadata: ArchiveMetadata | null = null;
      let fingerprint = `${stat.size}:${stat.mtimeMs}`;
      let reason = "旧恢复项缺少元数据，无法确认归属，已保护。";
      let bytes = stat.isFile() ? stat.size : 0;
      try {
        const metaPath = await this.safe(relative + ".meta.json");
        if ((await lstat(metaPath)).size > 65536) throw new MaintenanceError("恢复元数据过大。");
        const raw = await readFile(metaPath, "utf8");
        fingerprint += ":" + archiveHash(raw);
        metadata = metadataOf(raw, kind);
        const snapshot = await archiveSnapshot(payload);
        bytes = snapshot.bytes;
        fingerprint += ":" + snapshot.digest;
        if (
          snapshot.digest !== metadata.digest ||
          snapshot.bytes !== metadata.bytes ||
          snapshot.directory !== metadata.directory
        )
          throw new MaintenanceError("恢复内容已改变，与元数据不符，已保护。");
        if (metadata.articleBundle) await validateArticleBundle(payload);
        reason = "";
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") reason = (error as Error).message;
        metadata = null;
        if (stat.isDirectory())
          try {
            bytes = (await archiveSnapshot(payload)).bytes;
          } catch {
            warnings.push(`${relative} 体积不可确认，已保留。`);
          }
      }
      const item: ArchiveItem = {
        id: archiveHash(relative),
        kind,
        createdAt: metadata?.createdAt ?? stat.mtime.toISOString(),
        bytes,
        projectKey: metadata?.projectKey ?? null,
        projectName: metadata?.projectRoot
          ? path.basename(metadata.projectRoot)
          : metadata?.projectKey
            ? metadata.projectKey.slice(0, 12)
            : metadata?.domain === "settings" || metadata?.domain === "workspace"
              ? "本机面板"
              : "归属未知",
        originalPath: metadata?.relative ?? path.basename(payload),
        domain: metadata?.domain ?? "unknown",
        restorable: false,
        reason,
        protected: !metadata,
      };
      if (metadata) {
        try {
          const destination = await this.target(metadata, report);
          if (kind === "trash" && (await this.targetVersion(destination)) !== null)
            throw new MaintenanceError("原路径已存在，回收项不会覆盖现有内容。");
          if (metadata.articleBundle) {
            const prefix = report!.mode === "external" ? "posts/" : "src/content/posts/";
            await assertConversationRecoveryAvailable(
              this.stateDir,
              report!.root,
              metadata.relative.slice(prefix.length),
            );
          }
          item.restorable = true;
        } catch (error) {
          item.reason = (error as Error).message;
        }
        if (runningArchive(metadata)) {
          item.protected = true;
          item.restorable = false;
          item.reason = "项目仍有运行任务，已保护。";
        }
      }
      entries.push({ item, payload, metadata, fingerprint });
    }
    const latest = new Map<string, string>();
    entries.sort(
      (a, b) =>
        b.item.createdAt.localeCompare(a.item.createdAt) || a.item.id.localeCompare(b.item.id),
    );
    for (const entry of entries)
      if (entry.metadata) {
        const key = resourceKey(entry.metadata);
        if (!latest.has(key)) latest.set(key, entry.item.createdAt);
        // Millisecond timestamps can tie. Preserve all tied newest points instead of guessing.
        if (latest.get(key) === entry.item.createdAt) {
          entry.item.protected = true;
        }
      }
    return { entries, warnings };
  }
  private inventoryVersion(entries: Entry[]) {
    return archiveHash(
      JSON.stringify(
        entries.map((e) => [
          e.item.id,
          e.fingerprint,
          e.item.protected,
          e.item.restorable,
          e.item.reason,
        ]),
      ),
    );
  }
  async inventory(report: ProjectReport | null): Promise<ArchiveInventory> {
    const { entries, warnings } = await this.entries(report);
    return {
      items: entries.map((e) => e.item),
      version: this.inventoryVersion(entries),
      totals: {
        backup: entries
          .filter((e) => e.item.kind === "backup")
          .reduce((sum, e) => sum + e.item.bytes, 0),
        trash: entries
          .filter((e) => e.item.kind === "trash")
          .reduce((sum, e) => sum + e.item.bytes, 0),
        count: entries.length,
      },
      warnings,
      projectKey: report ? await settingsProjectKey(report.root) : null,
    };
  }
  private lease(value: Omit<Lease, "expires">, items: ArchiveItem[]): MaintenancePreview {
    for (const [id, old] of this.leases) if (old.expires < this.now()) this.leases.delete(id);
    if (this.leases.size >= 100) this.leases.delete(this.leases.keys().next().value!);
    const token = randomUUID();
    const expires = this.now() + 10 * 60 * 1000;
    this.leases.set(token, { ...value, expires });
    return {
      token,
      expiresAt: new Date(expires).toISOString(),
      items,
      bytes: items.reduce((sum, item) => sum + item.bytes, 0),
    };
  }
  private consume(token: string, kind: Lease["kind"]): Lease {
    const lease = this.leases.get(token);
    this.leases.delete(token);
    if (!lease || lease.kind !== kind || lease.expires < this.now())
      throw new StorageConflict("预览已失效，请重新预览。");
    return lease;
  }
  async restorePreview(id: string, report: ProjectReport | null): Promise<MaintenancePreview> {
    const { entries } = await this.entries(report);
    const entry = entries.find((e) => e.item.id === id);
    if (!entry?.metadata || !entry.item.restorable)
      throw new MaintenanceError(entry?.item.reason ?? "恢复项不存在。");
    const destination = await this.target(entry.metadata, report);
    const version = await this.targetVersion(destination);
    if (
      entry.metadata.relative === `secure/${aiVaultFileName}` &&
      entry.metadata.domain === "settings"
    )
      await new AiVault(entry.payload).status();
    return {
      ...this.lease(
        {
          kind: "restore",
          version: this.inventoryVersion(entries),
          projectKey: report ? await settingsProjectKey(report.root) : null,
          ids: [id],
          targetVersion: version,
        },
        [entry.item],
      ),
      destination: entry.metadata.relative,
      version,
    };
  }
  async restore(token: string, report: ProjectReport | null) {
    const lease = this.consume(token, "restore");
    const { entries } = await this.entries(report);
    if (
      lease.version !== this.inventoryVersion(entries) ||
      lease.projectKey !== (report ? await settingsProjectKey(report.root) : null)
    )
      throw new StorageConflict("恢复数据或项目状态已改变，请重新预览。");
    const entry = entries.find((e) => e.item.id === lease.ids[0]);
    if (!entry?.metadata || !entry.item.restorable)
      throw new MaintenanceError(entry?.item.reason ?? "恢复项不存在。");
    const metadata = entry.metadata;
    const target = await this.target(metadata, report);
    if ((await this.targetVersion(target)) !== lease.targetVersion)
      throw new StorageConflict("原文件自预览后已改变，请重新预览。");
    if (metadata.domain === "settings" && metadata.relative === `secure/${aiVaultFileName}`) {
      // Verify that this Windows account can decrypt before replacing the current ciphertext.
      const recovery = await new AiVault(entry.payload).recoverySource();
      const current = await readPanelSettings("browser", undefined, this.stateDir);
      if (current.readOnly)
        throw new MaintenanceError("本机偏好不可写，请先处理设置警告，未恢复 AI 配置。");
      await writeManagedFile(
        this.stateDir,
        metadata.relative,
        recovery.source,
        lease.targetVersion ?? null,
        path.join(this.stateDir, "backups", "settings"),
        { domain: "settings" },
      );
      await savePanelSettingsGroups(
        { scope: "browser", groups: { ai: { ...recovery.settings } }, version: current.version },
        this.stateDir,
      );
    } else if (metadata.domain === "settings") {
      const scope = metadata.projectKey
        ? "project"
        : metadata.relative === "personal-settings.json"
          ? "browser"
          : "machine";
      const snapshot = parseSettings(await readFile(entry.payload, "utf8"), scope);
      if (snapshot.readOnly || snapshot.warnings.length)
        throw new SettingsValidationError("备份设置无效或版本不兼容，原文件未修改。");
      // Strictly validate known fields, retaining only the settings schema.
      let validated = emptyDocument(scope);
      for (const [group, fields] of Object.entries(snapshot.document.values))
        validated = patchSettings(validated, scope, group, fields, "restore");
      if (scope === "browser") {
        const vault = aiVault(this.stateDir);
        const keys = await vault.keys();
        if (keys.some((key) => JSON.stringify(validated.values).includes(key)))
          throw new MaintenanceError("偏好备份含密钥，不能以明文恢复。");
        const status = await vault.status();
        if (
          status.version &&
          JSON.stringify(status.settings) !== JSON.stringify(validated.values.ai)
        )
          await vault.save({ version: status.version, settings: validated.values.ai, keys: {} });
      }
      await savePanelSettingsGroups(
        {
          scope,
          groups: validated.values,
          version: lease.targetVersion ?? null,
          projectKey: metadata.projectKey ?? undefined,
        },
        this.stateDir,
      );
    } else if (metadata.domain === "article") {
      const prefix = report!.mode === "external" ? "posts/" : "src/content/posts/";
      const id = metadata.relative.slice(prefix.length);
      if (metadata.articleBundle) {
        await restoreArticleConversations(
          this.stateDir,
          report!.root,
          id,
          entry.payload,
          metadata.digest,
          async (source) => {
            await validateArticleCreation(report!, id, source);
            await createArticleFromSource(report!, id, source);
          },
        );
      } else {
        const source = await readFile(entry.payload, "utf8");
        if (lease.targetVersion === null) {
          await validateArticleCreation(report!, id, source);
          await createArticleFromSource(report!, id, source);
        } else await saveArticleSource(report!, id, source, lease.targetVersion!);
      }
    } else if (metadata.kind === "backup") {
      const bytes = await readFile(entry.payload);
      if (bytes.length > 20 * 1024 * 1024 || !Buffer.from(bytes.toString("utf8")).equals(bytes))
        throw new MaintenanceError("文本备份过大或编码无效。");
      await writeManagedFile(
        metadata.root,
        metadata.relative,
        bytes.toString("utf8"),
        lease.targetVersion ?? null,
        path.join(this.stateDir, "backups"),
        { domain: metadata.domain, projectRoot: report!.root },
      );
    } else {
      await this.restoreTrash(entry, target);
    }
    return { message: "恢复已完成，恢复副本继续保留。" };
  }
  private async restoreTrash(entry: Entry, target: string) {
    const metadata = entry.metadata!;
    await mkdir(path.dirname(target), { recursive: true });
    const lockPath = target + ".mizuki-panel.lock";
    let lock;
    try {
      lock = await open(lockPath, "wx");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        throw new StorageConflict("原路径正在被其他操作修改。");
      throw error;
    }
    const temp = target + ".mizuki-panel-" + randomUUID() + ".tmp";
    try {
      if ((await this.targetVersion(target)) !== null)
        throw new StorageConflict("原路径已存在，不能覆盖。");
      await cp(entry.payload, temp, {
        recursive: metadata.directory,
        errorOnExist: true,
        force: false,
        mode: constants.COPYFILE_EXCL,
      });
      if ((await archiveSnapshot(temp)).digest !== metadata.digest)
        throw new StorageConflict("回收内容在恢复期间发生变化。");
      if ((await this.targetVersion(target)) !== null)
        throw new StorageConflict("原路径已出现新内容，不能覆盖。");
      if (metadata.directory) await rename(temp, target);
      else await link(temp, target);
    } finally {
      await rm(temp, { recursive: true, force: true });
      await lock.close();
      await rm(lockPath, { force: true });
    }
  }
  async cleanupPreview(
    report: ProjectReport | null,
    kind?: ArchiveItem["kind"],
  ): Promise<MaintenancePreview> {
    const { entries } = await this.entries(report);
    const policy = await readPanelSettings("machine", undefined, this.stateDir);
    if (policy.readOnly) throw new MaintenanceError("保留设置不可读取，不能计算清理范围。");
    const { enabled, days, count } = policy.document.values.maintenance;
    const counts = new Map<string, number>();
    const candidates = entries.filter((entry) => {
      if (!enabled || !entry.metadata || (kind && entry.item.kind !== kind)) return false;
      const key = resourceKey(entry.metadata);
      const rank = (counts.get(key) ?? 0) + 1;
      counts.set(key, rank);
      return (
        !entry.item.protected &&
        (Date.parse(entry.item.createdAt) < this.now() - Number(days) * 86400000 ||
          rank > Number(count))
      );
    });
    return this.lease(
      {
        kind: "cleanup",
        version: this.inventoryVersion(entries),
        projectKey: report ? await settingsProjectKey(report.root) : null,
        ids: candidates.map((e) => e.item.id),
        policyVersion: policy.version,
      },
      candidates.map((e) => e.item),
    );
  }
  async cleanup(token: string, ids: string[], report: ProjectReport | null) {
    const lease = this.consume(token, "cleanup");
    const { entries } = await this.entries(report);
    const policy = await readPanelSettings("machine", undefined, this.stateDir);
    if (
      lease.version !== this.inventoryVersion(entries) ||
      policy.version !== lease.policyVersion ||
      lease.projectKey !== (report ? await settingsProjectKey(report.root) : null)
    )
      throw new StorageConflict("清理预览已变化，请重新预览；尚未删除任何恢复项。");
    if (
      !ids.length ||
      ids.length > 2000 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !lease.ids.includes(id))
    )
      throw new MaintenanceError("只能清理预览中明确选中的恢复项。");
    const selected = ids.map((id) => entries.find((e) => e.item.id === id)!);
    for (const entry of selected)
      if (!entry.metadata || entry.item.protected || runningArchive(entry.metadata))
        throw new StorageConflict("选中恢复项已受保护，请重新预览。");
    const results: { id: string; success: boolean; message: string }[] = [];
    for (const entry of selected) {
      try {
        const relative = path.relative(this.stateDir, entry.payload);
        const safe = await this.safe(relative);
        if ((await archiveSnapshot(safe)).digest !== entry.metadata!.digest)
          throw new StorageConflict("恢复数据已改变，已保留。");
        await rm(safe, { recursive: entry.metadata!.directory });
        await rm(await this.safe(relative + ".meta.json"));
        results.push({ id: entry.item.id, success: true, message: "已清理" });
      } catch (error) {
        results.push({ id: entry.item.id, success: false, message: (error as Error).message });
      }
    }
    return { results };
  }
}
