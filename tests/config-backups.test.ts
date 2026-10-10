import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import type { ProjectReport } from "../src/lib/server/project";
import {
  createConfigBackup,
  listConfigBackups,
  readConfig,
  restoreConfig,
  saveConfig,
} from "../src/lib/server/configs";
import { withWorkspaceState } from "../src/lib/server/workspace-state";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
const original = '// original comment\nexport const siteConfig = { title: "Original" };\n';
async function fixture() {
  const base = await mkdtemp(path.join(tmpdir(), "mizuki-config-backups-"));
  temporary.push(base);
  const root = path.join(base, "project");
  const state = path.join(base, "state");
  await mkdir(path.join(root, "src/config"), { recursive: true });
  await writeFile(path.join(root, "src/config/siteConfig.ts"), original);
  await writeFile(
    path.join(root, "src/config/backgroundWallpaper.ts"),
    "export const fullscreenWallpaperConfig = { enabled: true };\n",
  );
  const report: ProjectReport = {
    root,
    requestedPath: root,
    mode: "local",
    readOnly: false,
    contentRoot: null,
    mappings: [],
    warnings: [],
  };
  return { base, state, report };
}

it("retains the latest five editing snapshots independently for each config and project", async () => {
  const { state, report } = await fixture();
  const second = await fixture();
  await withWorkspaceState(state, async () => {
    const wallpaper = await readConfig(report, "fullscreenWallpaperConfig");
    const wallpaperBackup = await createConfigBackup(
      report,
      "fullscreenWallpaperConfig",
      wallpaper.version,
    );
    const otherProject = await readConfig(second.report, "siteConfig");
    const otherBackup = await createConfigBackup(second.report, "siteConfig", otherProject.version);
    const ids: string[] = [];
    for (let index = 1; index <= 6; index++) {
      const current = await readConfig(report, "siteConfig");
      const before = await createConfigBackup(report, "siteConfig", current.version);
      ids.push(before.backup.id);
      await saveConfig(
        report,
        "siteConfig",
        `{ title: "Edit ${index}" }`,
        current.version,
        before.backup.id,
      );
    }
    const history = await listConfigBackups(report, "siteConfig");
    expect(history.map((entry) => entry.id)).toEqual(ids.slice(1).reverse());
    expect(await listConfigBackups(report, "fullscreenWallpaperConfig")).toEqual([
      wallpaperBackup.backup,
    ]);
    expect(await listConfigBackups(second.report, "siteConfig")).toEqual([otherBackup.backup]);
    const current = await readConfig(report, "siteConfig");
    await expect(restoreConfig(report, "siteConfig", ids[0], current.version)).rejects.toThrow(
      /已被替换/,
    );
    const restored = await restoreConfig(report, "siteConfig", history[0].id, current.version);
    expect(restored.effectiveValue).toMatchObject({ title: "Edit 5" });
    expect(await listConfigBackups(report, "siteConfig")).toHaveLength(5);
    expect(await listConfigBackups(report, "fullscreenWallpaperConfig")).toEqual([
      wallpaperBackup.backup,
    ]);
  });
});

it("backs up before saving and reuses that snapshot, preserving complete source and recovery of a restore", async () => {
  const { state, report } = await fixture();
  await withWorkspaceState(state, async () => {
    const current = await readConfig(report, "siteConfig");
    const before = await createConfigBackup(report, "siteConfig", current.version);
    expect(await readFile(path.join(report.root, "src/config/siteConfig.ts"), "utf8")).toBe(
      original,
    );
    const saved = await saveConfig(
      report,
      "siteConfig",
      '{ title: "Changed" }',
      current.version,
      before.backup.id,
    );
    expect(saved.backupPath).toBe(before.backup.id);
    expect(saved.backups).toHaveLength(1);
    const restored = await restoreConfig(
      report,
      "siteConfig",
      before.backup.id,
      saved.config.version,
    );
    expect(await readFile(path.join(report.root, "src/config/siteConfig.ts"), "utf8")).toBe(
      original,
    );
    const history = await listConfigBackups(report, "siteConfig");
    expect(history).toHaveLength(2);
    const undoRestore = await restoreConfig(report, "siteConfig", history[0].id, restored.version);
    expect(undoRestore.effectiveValue).toMatchObject({ title: "Changed" });
  });
});

it("rejects stale versions and backups belonging to another config or project without changing files", async () => {
  const { state, report } = await fixture();
  const other = await fixture();
  await withWorkspaceState(state, async () => {
    const current = await readConfig(report, "siteConfig");
    const before = await createConfigBackup(report, "siteConfig", current.version);
    const wallpaper = await readConfig(report, "fullscreenWallpaperConfig");
    const wallpaperBackup = await createConfigBackup(
      report,
      "fullscreenWallpaperConfig",
      wallpaper.version,
    );
    await expect(
      saveConfig(
        report,
        "siteConfig",
        '{ title: "Wrong" }',
        current.version,
        wallpaperBackup.backup.id,
      ),
    ).rejects.toThrow(/不属于当前配置/);
    await expect(
      restoreConfig(other.report, "siteConfig", before.backup.id, current.version),
    ).rejects.toThrow(/不属于当前配置/);
    await writeFile(
      path.join(report.root, "src/config/siteConfig.ts"),
      'export const siteConfig = { title: "External" };',
    );
    await expect(createConfigBackup(report, "siteConfig", current.version)).rejects.toThrow(
      /其他位置修改/,
    );
    await expect(
      restoreConfig(report, "siteConfig", before.backup.id, current.version),
    ).rejects.toThrow(/其他位置修改/);
    expect(await listConfigBackups(report, "siteConfig")).toEqual([before.backup]);
    expect((await readConfig(report, "siteConfig")).effectiveValue).toMatchObject({
      title: "External",
    });
  });
});

it("restores an absent external override by removing the newly created file, preserving its own backup", async () => {
  const { state, report, base } = await fixture();
  const contentRoot = path.join(base, "content");
  await mkdir(contentRoot);
  const external = { ...report, mode: "external" as const, contentRoot };
  await withWorkspaceState(state, async () => {
    const current = await readConfig(external, "siteConfig");
    const before = await createConfigBackup(external, "siteConfig", "");
    expect(before.backup.targetExists).toBe(false);
    const saved = await saveConfig(
      external,
      "siteConfig",
      '{ title: "Override" }',
      current.version,
      before.backup.id,
    );
    const restored = await restoreConfig(
      external,
      "siteConfig",
      before.backup.id,
      saved.config.version,
    );
    expect(restored.targetExists).toBe(false);
    expect(restored.effectiveValue).toMatchObject({ title: "Original" });
    await expect(readFile(path.join(contentRoot, "overrides/siteConfig.ts"))).rejects.toMatchObject(
      { code: "ENOENT" },
    );
    const history = await listConfigBackups(external, "siteConfig");
    const recovered = await restoreConfig(external, "siteConfig", history[0].id, restored.version);
    expect(recovered.effectiveValue).toMatchObject({ title: "Override" });
    expect(await listConfigBackups(report, "siteConfig")).toEqual([]);
  });
});

it("keeps all five existing backups when their atomic replacement fails", async () => {
  const { state, report } = await fixture();
  await withWorkspaceState(state, async () => {
    const current = await readConfig(report, "siteConfig");
    for (let index = 0; index < 5; index++)
      await createConfigBackup(report, "siteConfig", current.version);
    const history = await listConfigBackups(report, "siteConfig");
    const files = await readdir(path.join(state, "config-backups"));
    const filename = path.join(state, "config-backups", files[0]);
    await writeFile(filename + ".mizuki-panel.lock", "locked");
    await expect(createConfigBackup(report, "siteConfig", current.version)).rejects.toThrow(
      /其他操作修改/,
    );
    expect(await listConfigBackups(report, "siteConfig")).toEqual(history);
    expect(await readFile(path.join(report.root, "src/config/siteConfig.ts"), "utf8")).toBe(
      original,
    );
  });
});

it("does not overwrite corrupted history or create backups in a read-only project", async () => {
  const { state, report } = await fixture();
  await withWorkspaceState(state, async () => {
    const current = await readConfig(report, "siteConfig");
    await expect(
      createConfigBackup({ ...report, readOnly: true }, "siteConfig", current.version),
    ).rejects.toThrow(/只读/);
    expect(await listConfigBackups(report, "siteConfig")).toEqual([]);
    await createConfigBackup(report, "siteConfig", current.version);
    const [file] = await readdir(path.join(state, "config-backups"));
    const filename = path.join(state, "config-backups", file);
    await writeFile(filename, "invalid history");
    await expect(createConfigBackup(report, "siteConfig", current.version)).rejects.toThrow(/校验/);
    expect(await readFile(filename, "utf8")).toBe("invalid history");
    expect(await readFile(path.join(report.root, "src/config/siteConfig.ts"), "utf8")).toBe(
      original,
    );
  });
});
