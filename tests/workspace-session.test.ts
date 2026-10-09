import { mkdtemp, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import {
  WorkspaceSession,
  WorkspaceTaskError,
  readWorkspaceHistory,
} from "../src/lib/server/workspace-session";
import {
  readPanelSettings,
  savePanelSettings,
  settingsProjectKey,
} from "../src/lib/server/panel-settings";
import { inspectProject, type ProjectReport } from "../src/lib/server/project";
import { saveWorkspacePath } from "../src/lib/server/workspace";
import { StorageConflict } from "../src/lib/server/storage";
import type { WorkspaceTask } from "../src/shared/workspace";

const directories: string[] = [];
afterEach(async () => {
  for (const root of directories.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-workspace-session-"));
  directories.push(root);
  const stateDir = path.join(root, "state");
  const projects = await Promise.all(
    ["one", "two", "three"].map(async (name) => {
      const directory = path.join(root, name);
      await mkdir(path.join(directory, "src/config"), { recursive: true });
      await mkdir(path.join(directory, "scripts"));
      await writeFile(
        path.join(directory, "package.json"),
        JSON.stringify({ name: "mizuki", dependencies: { astro: "7" } }),
      );
      await writeFile(path.join(directory, "src/content.config.ts"), "");
      await writeFile(path.join(directory, "src/config/index.ts"), "");
      await writeFile(path.join(directory, "scripts/sync-content.js"), "");
      await writeFile(path.join(directory, ".env"), "ENABLE_CONTENT_SYNC=false\n");
      return realpath(directory);
    }),
  );
  const session = new WorkspaceSession(stateDir);
  const machine = async (fields: Record<string, unknown>) =>
    savePanelSettings(
      {
        scope: "machine",
        group: "workspace",
        fields,
        version: (await readPanelSettings("machine", undefined, stateDir)).version,
      },
      stateDir,
    );
  return { root, stateDir, projects, session, machine };
}
it("migrates the legacy connection once, preserving the original and restoring the last project", async () => {
  const { stateDir, projects, session } = await fixture();
  await saveWorkspacePath(projects[0], stateDir);
  const legacy = await readFile(path.join(stateDir, "workspace.json"), "utf8");
  const overview = await session.overview();
  expect(overview.report?.root).toBe(projects[0]);
  expect(overview.recentProjects[0].id).toBe(await settingsProjectKey(projects[0]));
  await session.connect(projects[1], overview.version);
  expect(await readFile(path.join(stateDir, "workspace.json"), "utf8")).toBe(legacy);
  expect((await new WorkspaceSession(stateDir).currentReport()).root).toBe(projects[1]);
});
it("applies startup changes only after restart and supports none/default without fallback", async () => {
  const { stateDir, projects, session, machine } = await fixture();
  await session.connect(projects[0], session.version);
  await session.connect(projects[1], session.version);
  await machine({ startup: "none" });
  expect(await session.active()).toBe(projects[1]);
  expect(await new WorkspaceSession(stateDir).active()).toBeNull();
  await machine({ startup: "default", defaultProject: await settingsProjectKey(projects[0]) });
  expect(await session.active()).toBe(projects[1]);
  expect(await new WorkspaceSession(stateDir).active()).toBe(projects[0]);
  await rename(projects[0], projects[0] + "-moved");
  const failed = await new WorkspaceSession(stateDir).overview();
  expect(failed.report).toBeNull();
  expect(failed.connectedPath).toBe(projects[0]);
  expect(failed.startupError).toContain("不存在");
  expect(failed.defaultProject?.available).toBe(false);
  expect(failed.recentProjects.find((item) => item.path === projects[1])?.available).toBe(true);
});
it("reports missing defaults and keeps unavailable legacy paths for explicit repair", async () => {
  const { stateDir, session, machine, root } = await fixture();
  await machine({ startup: "default" });
  expect((await session.overview()).startupError).toContain("尚未指定");
  const separate = path.join(root, "legacy-state");
  await saveWorkspacePath(path.join(root, "missing"), separate);
  const failed = await new WorkspaceSession(separate).overview();
  expect(failed.report).toBeNull();
  expect(failed.recentProjects[0].available).toBe(false);
});
it("deduplicates and limits recents, and removal never deletes settings, files or defaults", async () => {
  const { stateDir, projects, session, machine } = await fixture();
  await machine({ recentLimit: 2 });
  for (const root of projects) await session.connect(root, session.version);
  const id = await settingsProjectKey(projects[1]);
  await machine({ defaultProject: id });
  await savePanelSettings(
    {
      scope: "project",
      projectKey: id,
      group: "access",
      fields: { readOnly: true },
      version: null,
    },
    stateDir,
  );
  let overview = await session.connect(projects[1], session.version);
  expect(overview.recentProjects.map((item) => item.path)).toEqual([projects[1], projects[2]]);
  overview = await session.removeRecent(id, overview.historyVersion);
  expect(overview.recentProjects.map((item) => item.path)).toEqual([projects[2]]);
  expect(overview.defaultProject?.id).toBe(id);
  expect((await readPanelSettings("project", id, stateDir)).document.values.access.readOnly).toBe(
    true,
  );
  expect((await inspectProject(projects[1])).root).toBe(projects[1]);
});
it("rejects stale sessions, stale history and failed writes while retaining the active connection", async () => {
  const { stateDir, projects, session } = await fixture();
  const initial = await session.overview();
  const current = await session.connect(projects[0], initial.version);
  await expect(session.connect(projects[1], initial.version)).rejects.toBeInstanceOf(
    StorageConflict,
  );
  await expect(
    session.removeRecent(current.recentProjects[0].id, initial.historyVersion),
  ).rejects.toBeInstanceOf(StorageConflict);
  const lock = path.join(stateDir, "workspace-history.json.mizuki-panel.lock");
  await writeFile(lock, "");
  await expect(session.connect(projects[1], current.version)).rejects.toBeInstanceOf(
    StorageConflict,
  );
  expect(await session.active()).toBe(projects[0]);
  expect(session.version).toBe(current.version);
  await rm(lock);
  await session.disconnect(current.version);
  expect(await new WorkspaceSession(stateDir).active()).toBeNull();
});
it.each(["{ broken", '{"schemaVersion":99,"unknown":"keep"}'])(
  "preserves invalid/future history and allows only an ephemeral manual connection: %s",
  async (raw) => {
    const { stateDir, projects, session } = await fixture();
    await mkdir(stateDir);
    await writeFile(path.join(stateDir, "workspace-history.json"), raw);
    expect((await session.overview()).historyReadOnly).toBe(true);
    const connected = await session.connect(projects[0], session.version);
    expect(connected.report?.root).toBe(projects[0]);
    expect(connected.warnings.length).toBeGreaterThan(0);
    expect(await readFile(path.join(stateDir, "workspace-history.json"), "utf8")).toBe(raw);
    expect(await new WorkspaceSession(stateDir).active()).toBeNull();
  },
);
it("stops only an owned preview after target validation and explicit confirmation, and blocks publishing", async () => {
  const { stateDir, projects } = await fixture();
  let preview: WorkspaceTask | null = null;
  let publishing: WorkspaceTask | null = null;
  const stop = vi.fn(async (_report: ProjectReport) => {
    preview = null;
  });
  const session = new WorkspaceSession(stateDir, {
    inspect: inspectProject,
    preview: () => preview,
    publish: () => publishing,
    stop,
  });
  await session.connect(projects[0], session.version);
  preview = { kind: "preview", projectRoot: projects[0], canStop: true };
  await expect(session.connect(projects[1], session.version)).rejects.toBeInstanceOf(
    WorkspaceTaskError,
  );
  await expect(
    session.connect(path.join(stateDir, "missing"), session.version, true),
  ).rejects.toThrow("不存在");
  expect(stop).not.toHaveBeenCalled();
  await session.connect(projects[1], session.version, true);
  expect(stop).toHaveBeenCalledExactlyOnceWith({ root: projects[0] });
  publishing = { kind: "publish", projectRoot: projects[1], canStop: false };
  await expect(session.disconnect(session.version, true)).rejects.toBeInstanceOf(
    WorkspaceTaskError,
  );
  expect(await session.active()).toBe(projects[1]);
  expect(stop).toHaveBeenCalledTimes(1);
  publishing = null;
  await session.connect(projects[2], session.version); // External previews are never owned and never stopped.
  expect(stop).toHaveBeenCalledTimes(1);
});
it("does not switch if an owned preview is still stopping", async () => {
  const { stateDir, projects } = await fixture();
  let task: WorkspaceTask | null = null;
  const session = new WorkspaceSession(stateDir, {
    inspect: inspectProject,
    preview: () => task,
    publish: () => null,
    stop: async () => {},
  });
  await session.connect(projects[0], session.version);
  task = { kind: "preview", projectRoot: projects[0], canStop: true };
  await expect(session.disconnect(session.version, true)).rejects.toThrow("仍在停止");
  expect(await session.active()).toBe(projects[0]);
});
it("combines preference and detected read-only restrictions and fails closed for future project settings", async () => {
  const { stateDir, projects, session } = await fixture();
  await session.connect(projects[0], session.version);
  const key = await settingsProjectKey(projects[0]);
  const saved = await savePanelSettings(
    {
      scope: "project",
      projectKey: key,
      group: "access",
      fields: { readOnly: true },
      version: null,
    },
    stateDir,
  );
  expect((await session.currentReport()).preferenceReadOnly).toBe(true);
  await savePanelSettings(
    {
      scope: "project",
      projectKey: key,
      group: "access",
      fields: { readOnly: false },
      version: saved.version,
    },
    stateDir,
  );
  expect((await session.currentReport()).readOnly).toBe(false);
  await writeFile(
    path.join(projects[0], ".env"),
    "ENABLE_CONTENT_SYNC=true\nCONTENT_DIR=missing\n",
  );
  const detected = await session.currentReport();
  expect(detected.readOnly).toBe(true);
  expect(detected.detectedReadOnly).toBe(true);
  expect(detected.preferenceReadOnly).toBe(false);
  const future = '{"schemaVersion":99,"values":{"access":{"readOnly":false}},"unknown":"keep"}';
  await writeFile(path.join(stateDir, `project-settings/${key}.json`), future);
  expect((await session.currentReport()).settingsReadOnly).toBe(true);
  expect(await readFile(path.join(stateDir, `project-settings/${key}.json`), "utf8")).toBe(future);
});
it("previews reassociation, copies settings without overwriting originals, and rebinds a default", async () => {
  const { stateDir, projects, session, machine } = await fixture();
  const oldKey = await settingsProjectKey(projects[0]);
  await session.connect(projects[0], session.version);
  await savePanelSettings(
    {
      scope: "project",
      projectKey: oldKey,
      group: "access",
      fields: { readOnly: true },
      version: null,
    },
    stateDir,
  );
  const oldRaw = await readFile(path.join(stateDir, `project-settings/${oldKey}.json`), "utf8");
  await machine({ startup: "default", defaultProject: oldKey });
  await session.disconnect(session.version);
  const moved = projects[0] + "-moved";
  await rename(projects[0], moved);
  const history = await readWorkspaceHistory(stateDir);
  const preview = await session.reassociationPreview(oldKey, moved, history.version);
  expect(preview.copySettings).toBe(true);
  expect(preview.defaultChanges).toBe(true);
  expect((await readWorkspaceHistory(stateDir)).version).toBe(history.version);
  const after = await session.reassociate(oldKey, moved, history.version, preview.previewVersion);
  expect(after.recentProjects[0].path).toBe(await realpath(moved));
  expect(after.defaultProject?.id).toBe(preview.next.id);
  expect(
    await readFile(path.join(stateDir, `project-settings/${preview.next.id}.json`), "utf8"),
  ).toBe(oldRaw);
  expect(await readFile(path.join(stateDir, `project-settings/${oldKey}.json`), "utf8")).toBe(
    oldRaw,
  );
  expect((await new WorkspaceSession(stateDir).currentReport()).readOnly).toBe(true);
});
it("rejects expired reassociation previews and preserves an existing destination's settings", async () => {
  const { stateDir, projects, session, machine } = await fixture();
  const oldKey = await settingsProjectKey(projects[0]);
  await session.connect(projects[0], session.version);
  await session.disconnect(session.version);
  const history = await readWorkspaceHistory(stateDir);
  const preview = await session.reassociationPreview(oldKey, projects[1], history.version);
  await machine({ recentLimit: 4 });
  await expect(
    session.reassociate(oldKey, projects[1], history.version, preview.previewVersion),
  ).rejects.toBeInstanceOf(StorageConflict);
  const newKey = await settingsProjectKey(projects[1]);
  await savePanelSettings(
    {
      scope: "project",
      projectKey: newKey,
      group: "access",
      fields: { readOnly: true },
      version: null,
    },
    stateDir,
  );
  const target = await readFile(path.join(stateDir, `project-settings/${newKey}.json`), "utf8");
  const fresh = await session.reassociationPreview(oldKey, projects[1], history.version);
  expect(fresh.copySettings).toBe(false);
  await session.reassociate(oldKey, projects[1], history.version, fresh.previewVersion);
  expect(await readFile(path.join(stateDir, `project-settings/${newKey}.json`), "utf8")).toBe(
    target,
  );
});
it("preserves future machine preferences and pauses automatic startup", async () => {
  const { stateDir, projects, session } = await fixture();
  await saveWorkspacePath(projects[0], stateDir);
  const raw = '{"schemaVersion":99,"values":{"workspace":{"startup":"last"}},"unknown":"keep"}';
  await writeFile(path.join(stateDir, "settings.json"), raw);
  expect((await session.overview()).report).toBeNull();
  expect((await session.overview()).startupError).toContain("更新版本");
  await session.connect(projects[0], session.version);
  expect(await session.active()).toBe(projects[0]);
  expect(await readFile(path.join(stateDir, "settings.json"), "utf8")).toBe(raw);
});
it("reports partial reassociation when default settings cannot be saved and preserves both setting copies", async () => {
  const { stateDir, projects, session, machine } = await fixture();
  const oldKey = await settingsProjectKey(projects[0]);
  await session.connect(projects[0], session.version);
  await machine({ defaultProject: oldKey });
  await savePanelSettings(
    {
      scope: "project",
      projectKey: oldKey,
      group: "access",
      fields: { readOnly: true },
      version: null,
    },
    stateDir,
  );
  const source = path.join(stateDir, `project-settings/${oldKey}.json`);
  const custom = JSON.parse(await readFile(source, "utf8"));
  custom.extension = { keep: true };
  custom.values.access.unknown = "preserve";
  const raw = JSON.stringify(custom);
  await writeFile(source, raw);
  await session.disconnect(session.version);
  const history = await readWorkspaceHistory(stateDir);
  const preview = await session.reassociationPreview(oldKey, projects[1], history.version);
  await writeFile(path.join(stateDir, "settings.json.mizuki-panel.lock"), "");
  await expect(
    session.reassociate(oldKey, projects[1], history.version, preview.previewVersion),
  ).rejects.toThrow("路径记录已关联");
  expect((await readWorkspaceHistory(stateDir)).document.recent).toEqual([preview.next.id]);
  expect(
    (await readPanelSettings("machine", undefined, stateDir)).document.values.workspace
      .defaultProject,
  ).toBe(oldKey);
  expect(await readFile(source, "utf8")).toBe(raw);
  expect(
    await readFile(path.join(stateDir, `project-settings/${preview.next.id}.json`), "utf8"),
  ).toBe(raw);
});
