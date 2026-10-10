import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { emptyDocument } from "../src/shared/panel-settings";
import {
  readPanelSettings,
  savePanelSettings,
  settingsProjectKey,
} from "../src/lib/server/panel-settings";

const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-settings-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
it("reads missing defaults without creating files and atomically saves with version checks", async () => {
  const state = path.join(await fixture(), "state");
  const original = await readPanelSettings("machine", undefined, state);
  expect(original.version).toBeNull();
  const saved = await savePanelSettings(
    { scope: "machine", group: "workspace", fields: { recentLimit: 20 }, version: null },
    state,
  );
  expect(saved.document.values.workspace.recentLimit).toBe(20);
  expect(saved.version).not.toBeNull();
  await expect(
    savePanelSettings(
      { scope: "machine", group: "workspace", fields: { recentLimit: 30 }, version: null },
      state,
    ),
  ).rejects.toThrow("其他操作修改");
  const next = await savePanelSettings(
    { scope: "machine", group: "workspace", fields: { recentLimit: 25 }, version: saved.version },
    state,
  );
  expect(next.version).not.toBe(saved.version);
  expect(
    (await readdir(path.join(state, "backups/settings"))).filter((name) => name.endsWith(".bak")),
  ).toHaveLength(1);
  expect(
    (await readdir(path.join(state, "backups/settings"))).filter((name) =>
      name.endsWith(".meta.json"),
    ),
  ).toHaveLength(1);
  expect((await readdir(state)).some((entry) => /\.(?:tmp|lock)$/.test(entry))).toBe(false);
});
it("isolates real project identities and does not write into either project", async () => {
  const root = await fixture();
  const state = path.join(root, "state");
  const a = path.join(root, "A"),
    b = path.join(root, "B");
  await mkdir(a);
  await mkdir(b);
  const keyA = await settingsProjectKey(a),
    keyB = await settingsProjectKey(b);
  expect(keyA).not.toBe(keyB);
  expect(await settingsProjectKey(path.join(a, "."))).toBe(keyA);
  await savePanelSettings(
    {
      scope: "project",
      projectKey: keyA,
      group: "media",
      fields: { folder: "文章图片", scope: "article" },
      version: null,
    },
    state,
  );
  expect((await readPanelSettings("project", keyB, state)).document.values.media.folder).toBe("");
  expect(await readdir(a)).toEqual([]);
  expect(await readdir(b)).toEqual([]);
  await expect(
    savePanelSettings(
      {
        scope: "project",
        projectKey: "../outside",
        group: "media",
        fields: { scope: "public" },
        version: null,
      },
      state,
    ),
  ).rejects.toThrow("项目标识");
  await expect(
    savePanelSettings(
      {
        scope: "project",
        projectKey: keyB,
        group: "media",
        fields: { folder: "../outside" },
        version: null,
      },
      state,
    ),
  ).rejects.toThrow("无效");
});
it("detects external edits, future/corrupt files and concurrent writes", async () => {
  const state = await fixture();
  const first = await savePanelSettings(
    { scope: "machine", group: "workspace", fields: { recentLimit: 15 }, version: null },
    state,
  );
  const writes = await Promise.allSettled(
    [20, 30].map((recentLimit) =>
      savePanelSettings(
        { scope: "machine", group: "workspace", fields: { recentLimit }, version: first.version },
        state,
      ),
    ),
  );
  expect(writes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const current = await readPanelSettings("machine", undefined, state);
  await writeFile(
    path.join(state, "settings.json"),
    JSON.stringify({ ...current.document, updatedAt: "external-edit" }),
  );
  await expect(
    savePanelSettings(
      {
        scope: "machine",
        group: "workspace",
        fields: { recentLimit: 10 },
        version: current.version,
      },
      state,
    ),
  ).rejects.toThrow("其他操作修改");
  for (const raw of [
    "broken",
    JSON.stringify({ ...emptyDocument("machine"), schemaVersion: 99 }),
  ]) {
    await writeFile(path.join(state, "settings.json"), raw);
    const snapshot = await readPanelSettings("machine", undefined, state);
    expect(snapshot.readOnly).toBe(true);
    await expect(
      savePanelSettings(
        {
          scope: "machine",
          group: "workspace",
          fields: { recentLimit: 10 },
          version: snapshot.version,
        },
        state,
      ),
    ).rejects.toThrow();
    expect(await readFile(path.join(state, "settings.json"), "utf8")).toBe(raw);
  }
});
