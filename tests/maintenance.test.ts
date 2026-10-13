import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { MaintenanceStore } from "../src/lib/server/maintenance";
import { recordArchive } from "../src/lib/server/archive-metadata";
import { withWorkspaceState } from "../src/lib/server/workspace-state";
import {
  createArticle,
  deleteArticle,
  readArticle,
  saveArticleSource,
} from "../src/lib/server/articles";
import { deleteAlbum } from "../src/lib/server/features";
import { readPanelSettings, savePanelSettings } from "../src/lib/server/panel-settings";
import type { ProjectReport } from "../src/lib/server/project";
import * as previewService from "../src/lib/server/preview";
import { writeManagedFile, restoreManagedFile, contentVersion } from "../src/lib/server/storage";
import { Hono } from "hono";
import { registerMaintenanceRoutes } from "../src/server/routes/maintenance";
import { ApiError } from "../src/server/errors";
const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
it("aborts content replacement when metadata cannot be recorded and rejects a backup for a different target", async () => {
  const { site, state, store } = await fixture();
  const file = path.join(site, "a.txt");
  await writeFile(file, "original");
  const backupRoot = path.join(state, "backups");
  await expect(
    writeManagedFile(site, "a.txt", "replacement", contentVersion("original"), backupRoot, {
      domain: "article",
      projectRoot: path.join(site, "missing"),
    }),
  ).rejects.toThrow();
  expect(await readFile(file, "utf8")).toBe("original");
  expect((await store.inventory(null)).items[0]).toMatchObject({
    protected: true,
    restorable: false,
  });
  const saved = await writeManagedFile(
    site,
    "a.txt",
    "new",
    contentVersion("original"),
    backupRoot,
    { domain: "article", projectRoot: site },
  );
  await writeFile(path.join(site, "b.txt"), "other");
  await expect(
    restoreManagedFile(site, "b.txt", saved.backupPath!, contentVersion("other"), backupRoot, {
      domain: "article",
      projectRoot: site,
    }),
  ).rejects.toThrow("归属");
  expect(await readFile(path.join(site, "b.txt"), "utf8")).toBe("other");
});
async function fixture(mode: "local" | "external" = "local") {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-maintenance-"));
  roots.push(root);
  const site = path.join(root, "site");
  const state = path.join(root, "state");
  const content = mode === "external" ? path.join(root, "content") : null;
  await mkdir(site);
  await mkdir(state);
  if (content) await mkdir(content);
  const report: ProjectReport = {
    root: site,
    requestedPath: site,
    contentRoot: content,
    mode,
    readOnly: false,
    warnings: [],
    mappings: [],
  };
  const store = new MaintenanceStore(state);
  const run = <T>(work: () => T) => withWorkspaceState(state, work);
  return { root, site, state, report, store, run };
}
it("counts only indexed resources in the dedicated recycle directory and ignores legacy/test debris", async () => {
  const { state, site, report, store, run } = await fixture();
  const legacy = path.join(state, "trash/features");
  await mkdir(legacy, { recursive: true });
  await writeFile(path.join(legacy, "old-season.md"), "old test payload");
  await recordArchive(
    path.join(legacy, "old-season.md"),
    "trash",
    site,
    "src/content/animes/2027/1月.md",
    {
      domain: "feature",
      projectRoot: site,
    },
  );
  const recycle = path.join(state, "recycle-bin/articles");
  await mkdir(recycle, { recursive: true });
  await writeFile(path.join(recycle, "untracked.md"), "not recycled");
  await writeFile(path.join(recycle, "orphan.md.meta.json"), "{}");
  expect(
    (await store.inventory(report)).items.filter((item) => item.kind === "trash"),
  ).toHaveLength(0);
  await run(() =>
    createArticle(report, "a.md", { title: "A", published: "2026-10-10", draft: true }, "original"),
  );
  const original = await readArticle(report, "a.md");
  await run(() => saveArticleSource(report, "a.md", original.source + "changed", original.version));
  const latest = await readArticle(report, "a.md");
  await run(() => deleteArticle(report, "a.md", latest.version));
  const inventory = await store.inventory(report);
  expect(inventory.items.filter((item) => item.kind === "trash")).toHaveLength(1);
  expect(inventory.items.filter((item) => item.kind === "backup")).toHaveLength(1);
  expect(inventory.totals.trash).toBe(Buffer.byteLength(latest.source));
  expect(inventory.warnings.some((warning) => warning.includes("缺少回收记录"))).toBe(true);
  expect(await readFile(path.join(legacy, "old-season.md"), "utf8")).toBe("old test payload");
});
for (const mode of ["local", "external"] as const)
  it(`indexes article backups and restores the correct ${mode} project with a new recovery point`, async () => {
    const { state, report, store, run } = await fixture(mode);
    await run(() =>
      createArticle(
        report,
        "a.md",
        { title: "A", published: "2026-10-10", draft: true },
        "original",
      ),
    );
    const original = await readArticle(report, "a.md");
    const saved = await run(() =>
      saveArticleSource(
        report,
        "a.md",
        original.source.replace("original", "changed"),
        original.version,
      ),
    );
    const inventory = await store.inventory(report);
    expect(inventory.items).toHaveLength(1);
    expect(inventory.items[0]).toMatchObject({
      domain: "article",
      restorable: true,
      protected: true,
    });
    expect(saved.backupPath?.startsWith(state)).toBe(true);
    const preview = await store.restorePreview(inventory.items[0].id, report);
    await run(() => store.restore(preview.token, report));
    expect((await readArticle(report, "a.md")).source).toBe(original.source);
    expect((await store.inventory(report)).items).toHaveLength(2);
  });
it("restores a deleted article, preserves the recovery copy, and never overwrites an occupied path", async () => {
  const { report, store, run } = await fixture();
  await run(() =>
    createArticle(report, "a.md", { title: "A", published: "2026-10-10", draft: true }, "original"),
  );
  const article = await readArticle(report, "a.md");
  await run(() => deleteArticle(report, "a.md", article.version));
  const item = (await store.inventory(report)).items[0];
  expect(item.kind).toBe("trash");
  const preview = await store.restorePreview(item.id, report);
  await run(() => store.restore(preview.token, report));
  expect((await readArticle(report, "a.md")).source).toBe(article.source);
  expect((await store.inventory(report)).items[0].restorable).toBe(false);
  await expect(store.restorePreview(item.id, report)).rejects.toThrow("原路径已存在");
});
it("checks disk version after preview, project identity, read-only state and changed content roots", async () => {
  const { root, site, report, store, run } = await fixture();
  await run(() =>
    createArticle(report, "a.md", { title: "A", published: "2026-10-10", draft: true }, "original"),
  );
  const article = await readArticle(report, "a.md");
  await run(() => saveArticleSource(report, "a.md", article.source + "\nchanged", article.version));
  const id = (await store.inventory(report)).items[0].id;
  const preview = await store.restorePreview(id, report);
  await writeFile(path.join(site, "src/content/posts/a.md"), article.source + "\nexternal change");
  await expect(run(() => store.restore(preview.token, report))).rejects.toThrow(
    "原文件自预览后已改变",
  );
  expect((await readArticle(report, "a.md")).source).toContain("external change");
  await expect(store.restorePreview(id, { ...report, readOnly: true })).rejects.toThrow("只读");
  const other = path.join(root, "other");
  await mkdir(other);
  await expect(store.restorePreview(id, { ...report, root: other })).rejects.toThrow("所属项目");
  await expect(
    store.restorePreview(id, { ...report, mode: "external", contentRoot: other }),
  ).rejects.toThrow("根目录已改变");
});
it("recovers complete album directories without overwriting existing albums", async () => {
  const { site, report, store, run } = await fixture();
  const album = path.join(site, "public/images/albums/trip");
  await mkdir(album, { recursive: true });
  await writeFile(path.join(album, "info.json"), JSON.stringify({ title: "Trip" }));
  await writeFile(path.join(album, "cover.jpg"), Buffer.from([1, 2, 3, 4]));
  const { contentVersion } = await import("../src/lib/server/storage");
  const version = contentVersion(await readFile(path.join(album, "info.json")));
  await run(() => deleteAlbum(report, "trip", version));
  const item = (await store.inventory(report)).items[0];
  expect(item.bytes).toBeGreaterThan(4);
  const preview = await store.restorePreview(item.id, report);
  await run(() => store.restore(preview.token, report));
  expect(await readFile(path.join(album, "cover.jpg"))).toEqual(Buffer.from([1, 2, 3, 4]));
  await expect(store.restorePreview(item.id, report)).rejects.toThrow("占用");
});
it("retains legacy and damaged recovery data with accurate totals and no guessed restoration", async () => {
  const { state, store } = await fixture();
  const backups = path.join(state, "backups/articles");
  await mkdir(backups, { recursive: true });
  await writeFile(path.join(backups, "old.bak"), "legacy");
  await writeFile(path.join(backups, "bad.bak"), "broken");
  await writeFile(path.join(backups, "bad.bak.meta.json"), "{}");
  const inventory = await store.inventory(null);
  expect(inventory.totals.backup).toBe(12);
  expect(
    inventory.items.every((item) => item.protected && !item.restorable && item.projectKey === null),
  ).toBe(true);
  expect((await store.cleanupPreview(null)).items).toHaveLength(0);
  await expect(store.restorePreview(inventory.items[0].id, null)).rejects.toThrow();
});
async function settingsBackups(state: string) {
  let snapshot = await readPanelSettings("machine", undefined, state);
  for (let n = 0; n < 5; n++)
    snapshot = await savePanelSettings(
      { scope: "machine", group: "logs", fields: { preview: 300 + n }, version: snapshot.version },
      state,
    );
  return savePanelSettings(
    {
      scope: "machine",
      group: "maintenance",
      fields: { enabled: true, count: 1, days: 3650 },
      version: snapshot.version,
    },
    state,
  );
}
it("manually clears only selected older points, always protecting the latest point", async () => {
  const { state, store } = await fixture();
  await settingsBackups(state);
  const inventory = await store.inventory(null);
  expect(inventory.items.filter((item) => item.protected)).toHaveLength(1);
  const preview = await store.cleanupPreview(null);
  expect(preview.items).toHaveLength(4);
  const result = await store.cleanup(preview.token, [preview.items[0].id], null);
  expect(result.results[0].success).toBe(true);
  expect((await store.inventory(null)).items).toHaveLength(4);
  const next = await store.cleanupPreview(null);
  const protectedId = (await store.inventory(null)).items.find((item) => item.protected)!.id;
  await expect(store.cleanup(next.token, [protectedId], null)).rejects.toThrow("明确选中");
});
it("isolates backup and recycle cleanup previews and rejects IDs from the other kind", async () => {
  const { state, site, store } = await fixture();
  await settingsBackups(state);
  const trash = path.join(state, "recycle-bin/articles");
  await mkdir(trash, { recursive: true });
  for (let i = 0; i < 3; i++) {
    const file = path.join(trash, `${i}.md`);
    await writeFile(file, `recycled ${i}`);
    await recordArchive(file, "trash", site, "src/content/posts/removed.md", {
      domain: "article",
      projectRoot: site,
    });
    const metadata = JSON.parse(await readFile(file + ".meta.json", "utf8"));
    metadata.createdAt = new Date(Date.now() - (i + 1) * 86400000).toISOString();
    await writeFile(file + ".meta.json", JSON.stringify(metadata));
  }
  const backups = await store.cleanupPreview(null, "backup"),
    recycled = await store.cleanupPreview(null, "trash");
  expect(backups.items.length).toBeGreaterThan(0);
  expect(recycled.items).toHaveLength(2);
  expect(backups.items.every((item) => item.kind === "backup")).toBe(true);
  expect(recycled.items.every((item) => item.kind === "trash")).toBe(true);
  expect(recycled.bytes).toBe(recycled.items.reduce((total, item) => total + item.bytes, 0));
  await expect(store.cleanup(recycled.token, [backups.items[0].id], null)).rejects.toThrow(
    "明确选中",
  );
  const backupIds = (await store.inventory(null)).items
    .filter((item) => item.kind === "backup")
    .map((item) => item.id);
  const next = await store.cleanupPreview(null, "trash");
  await store.cleanup(
    next.token,
    next.items.map((item) => item.id),
    null,
  );
  const remaining = (await store.inventory(null)).items;
  expect(remaining.filter((item) => item.kind === "backup").map((item) => item.id)).toEqual(
    backupIds,
  );
  expect(remaining.filter((item) => item.kind === "trash")).toHaveLength(1);
});
it("validates cleanup kinds while preserving the legacy unfiltered request", async () => {
  const { state } = await fixture();
  await settingsBackups(state);
  const app = new Hono();
  registerMaintenanceRoutes(app, state);
  app.onError((error, context) =>
    context.json({ message: error.message }, error instanceof ApiError ? error.status : 500),
  );
  const post = (body?: string) =>
    app.request("/api/maintenance/cleanup-preview", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });
  const backup = await post(JSON.stringify({ kind: "backup" }));
  expect(backup.status).toBe(200);
  expect(
    (await backup.json()).items.every((item: { kind: string }) => item.kind === "backup"),
  ).toBe(true);
  expect((await (await post(JSON.stringify({ kind: "trash" }))).json()).items).toEqual([]);
  expect((await (await post()).json()).items.length).toBeGreaterThan(0);
  for (const invalid of ['{"kind":"all"}', '{"kind":null}', "null", "broken-json"])
    expect((await post(invalid)).status).toBe(400);
});
it("keeps all recovery points when the retention rule is disabled", async () => {
  const { state, store } = await fixture();
  const saved = await settingsBackups(state);
  await savePanelSettings(
    { scope: "machine", group: "maintenance", fields: { enabled: false }, version: saved.version },
    state,
  );
  expect((await store.cleanupPreview(null)).items).toHaveLength(0);
  expect((await store.inventory(null)).items).toHaveLength(6);
});
it("protects all newest recovery points when timestamps tie", async () => {
  const { state, store } = await fixture();
  await settingsBackups(state);
  const directory = path.join(state, "backups/settings");
  const names = (await readdir(directory)).filter((name) => name.endsWith(".meta.json"));
  const newest = new Date(Date.now() + 60000).toISOString();
  for (const name of names.slice(0, 2)) {
    const filename = path.join(directory, name);
    const metadata = JSON.parse(await readFile(filename, "utf8"));
    metadata.createdAt = newest;
    await writeFile(filename, JSON.stringify(metadata));
  }
  expect((await store.inventory(null)).items.filter((item) => item.protected)).toHaveLength(2);
  expect((await store.cleanupPreview(null)).items).toHaveLength(3);
});
it("invalidates cleanup when data or retention changes and expires preview tokens", async () => {
  const { state, store } = await fixture();
  const saved = await settingsBackups(state);
  const preview = await store.cleanupPreview(null);
  await savePanelSettings(
    { scope: "machine", group: "maintenance", fields: { count: 2 }, version: saved.version },
    state,
  );
  await expect(store.cleanup(preview.token, [preview.items[0].id], null)).rejects.toThrow(
    "预览已变化",
  );
  expect((await store.inventory(null)).items).toHaveLength(6);
  let now = Date.now();
  const expiring = new MaintenanceStore(state, () => now);
  const expired = await expiring.cleanupPreview(null);
  now += 600001;
  await expect(expiring.cleanup(expired.token, [expired.items[0].id], null)).rejects.toThrow(
    "预览已失效",
  );
});
it("protects recovery points while tasks run, including project settings without stored paths", async () => {
  const { state, report, store, run } = await fixture();
  await run(() =>
    createArticle(report, "a.md", { title: "A", published: "2026-10-10", draft: true }, "original"),
  );
  const article = await readArticle(report, "a.md");
  await run(() => saveArticleSource(report, "a.md", article.source + "changed", article.version));
  const { settingsProjectKey } = await import("../src/lib/server/panel-settings");
  const key = await settingsProjectKey(report.root);
  let snapshot = await savePanelSettings(
    { scope: "project", projectKey: key, group: "preview", fields: { port: 4322 }, version: null },
    state,
  );
  await savePanelSettings(
    {
      scope: "project",
      projectKey: key,
      group: "preview",
      fields: { port: 4323 },
      version: snapshot.version,
    },
    state,
  );
  vi.spyOn(previewService, "workspacePreviewTask").mockReturnValue({
    kind: "preview",
    projectRoot: report.root,
    canStop: true,
  });
  const inventory = await store.inventory(report);
  expect(
    inventory.items.every(
      (item) => item.protected && !item.restorable && item.reason.includes("运行任务"),
    ),
  ).toBe(true);
});
it("rejects tampered payloads and paths outside allowed resources, skips symlinked archives", async () => {
  const { state, site, report, store } = await fixture();
  const root = path.join(state, "recycle-bin/media");
  await mkdir(root, { recursive: true });
  const payload = path.join(root, "image.png");
  await writeFile(payload, "abc");
  await recordArchive(payload, "trash", site, "public/images/image.png", {
    domain: "media",
    projectRoot: site,
  });
  await writeFile(payload, "tampered");
  expect((await store.inventory(report)).items[0]).toMatchObject({
    protected: true,
    restorable: false,
  });
  const outside = path.join(site, "outside");
  await mkdir(outside);
  await writeFile(path.join(outside, "secret"), "keep");
  await symlink(
    outside,
    path.join(state, "backups"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const inventory = await store.inventory(report);
  expect(inventory.warnings.length).toBeGreaterThan(0);
  expect(await readFile(path.join(outside, "secret"), "utf8")).toBe("keep");
});
it("restores machine settings using schema validation and backs up current preferences", async () => {
  const { state, store } = await fixture();
  let saved = await savePanelSettings(
    { scope: "machine", group: "logs", fields: { preview: 321 }, version: null },
    state,
  );
  saved = await savePanelSettings(
    { scope: "machine", group: "logs", fields: { preview: 456 }, version: saved.version },
    state,
  );
  const id = (await store.inventory(null)).items[0].id;
  const preview = await store.restorePreview(id, null);
  await store.restore(preview.token, null);
  expect((await readPanelSettings("machine", undefined, state)).document.values.logs.preview).toBe(
    321,
  );
  expect(
    (await readdir(path.join(state, "backups/settings"))).filter((name) => name.endsWith(".bak")),
  ).toHaveLength(2);
});
