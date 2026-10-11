import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { afterEach, expect, it, vi } from "vitest";
import type { ProjectReport } from "../src/lib/server/project";
import { defaultValues, emptyDocument, patchSettings } from "../src/shared/panel-settings";
import { validPreviewPath } from "../src/shared/task-settings";
import {
  readPanelSettings,
  savePanelSettings,
  settingsProjectKey,
} from "../src/lib/server/panel-settings";
import {
  taskPreferences,
  rememberPublishDefaults,
  readLogRetention,
  updateLogRetention,
} from "../src/lib/server/task-preferences";
import {
  previewStatus,
  startPreview,
  stopPreview,
  workspacePreviewTask,
} from "../src/lib/server/preview";
import {
  commitSelected,
  startPublishOperation,
  publishOperationStatus,
} from "../src/lib/server/publish";

const roots: string[] = [];
const reports: { report: ProjectReport; stateDir: string }[] = [];
const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  for (const item of reports.splice(0))
    if (workspacePreviewTask()?.projectRoot === item.report.root)
      await stopPreview(item.report, item.stateDir);
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function port() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const value = (server.address() as { port: number }).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return value;
}
async function fixture() {
  const base = await mkdtemp(path.join(tmpdir(), "mizuki-task-settings-"));
  roots.push(base);
  const root = path.join(base, "site"),
    stateDir = path.join(base, "state");
  await mkdir(path.join(root, "src/content/posts"), { recursive: true });
  await mkdir(path.join(root, "node_modules/astro/bin"), { recursive: true });
  await writeFile(path.join(root, "src/content/posts/one.md"), "# One\n");
  await writeFile(
    path.join(root, "node_modules/astro/bin/astro.mjs"),
    `import {createServer} from 'node:http'; const port=Number(process.argv[process.argv.indexOf('--port')+1]); console.log('argv '+JSON.stringify(process.argv)); createServer((req,res)=>{if(req.url==='/logs')for(let i=0;i<180;i++)console.log('line '+i);res.end('ready');}).listen(port,'127.0.0.1',()=>console.log('ready'));`,
  );
  const report: ProjectReport = {
    root,
    requestedPath: root,
    mode: "local",
    contentRoot: null,
    readOnly: false,
    warnings: [],
    mappings: [
      {
        key: "posts",
        label: "文章",
        sourcePath: path.join(root, "src/content/posts"),
        exists: true,
      },
    ],
  };
  reports.push({ report, stateDir });
  const key = await settingsProjectKey(root);
  const save = async (
    scope: "machine" | "project",
    group: string,
    fields: Record<string, unknown>,
  ) => {
    const snapshot = await readPanelSettings(
      scope,
      scope === "project" ? key : undefined,
      stateDir,
    );
    return savePanelSettings(
      {
        scope,
        group,
        fields,
        projectKey: scope === "project" ? key : undefined,
        version: snapshot.version,
      },
      stateDir,
    );
  };
  return { root, stateDir, report, save };
}
it("preserves defaults and validates ports, paths, scope and log limits", () => {
  expect(defaultValues("project").preview).toEqual({ port: 4321, path: "/" });
  expect(defaultValues("project").publish).toEqual({
    remember: false,
    type: "feat",
    scope: "content",
  });
  expect(defaultValues("machine").logs).toEqual({ preview: 300, publish: 500 });
  expect(defaultValues("browser").logs).toEqual({ autoScroll: true, fontSize: 12 });
  for (const invalid of [
    "https://example.com/",
    "//example.com/",
    "/../escape",
    "/%2e%2e/escape",
    "/bad\\path",
    "/%0a",
    "/%zz",
    "/%2fexample.com",
  ])
    expect(validPreviewPath(invalid)).toBe(false);
  expect(validPreviewPath("/posts/%E4%B8%AD%E6%96%87/?q=a%20b#title")).toBe(true);
  for (const [scope, group, fields] of [
    ["project", "preview", { port: 1023 }],
    ["project", "preview", { port: 65536 }],
    ["project", "publish", { scope: "UPPER" }],
    ["machine", "logs", { publish: 99 }],
    ["browser", "logs", { fontSize: 25 }],
  ] as const)
    expect(() => patchSettings(emptyDocument(scope), scope, group, fields, "test")).toThrow();
});
it("starts with the saved port, keeps a running task on its original port, then applies a new port", async () => {
  const { report, stateDir, save } = await fixture();
  const first = await port(),
    second = await port();
  await save("project", "preview", { port: first, path: "/about/" });
  const started = await startPreview(report, stateDir);
  expect(started.port).toBe(first);
  await vi.waitFor(
    async () => expect((await previewStatus(report, stateDir)).state).toBe("running"),
    { timeout: 10000 },
  );
  await save("project", "preview", { port: second, path: "/changed/" });
  const pending = await previewStatus(report, stateDir);
  expect(pending).toMatchObject({
    state: "running",
    port: first,
    configuredPort: second,
    pendingPort: true,
    defaultPath: "/changed/",
  });
  expect((await startPreview(report, stateDir)).port).toBe(first);
  expect(pending.logs.join("\n")).toContain(`\"${first}\"`);
  await expect(stopPreview({ ...report, root: report.root + "other" }, stateDir)).rejects.toThrow(
    "不属于",
  );
  // Workspace switching stops the owned task with only its root available.
  const stopped = await stopPreview({ root: report.root } as ProjectReport);
  expect(stopped.configuredPort).toBe(second);
  expect((await startPreview(report, stateDir)).port).toBe(second);
  await vi.waitFor(
    async () => expect((await previewStatus(report, stateDir)).state).toBe("running"),
    { timeout: 10000 },
  );
}, 20000);
it("connects an external HTTP service without owning or stopping it and reports other occupied ports", async () => {
  const { report, stateDir, save } = await fixture();
  const server = createServer((_req, res) => res.end("external"));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const value = (server.address() as { port: number }).port;
  await save("project", "preview", { port: value });
  expect((await startPreview(report, stateDir)).state).toBe("external");
  expect(workspacePreviewTask()).toBeNull();
  await stopPreview(report, stateDir);
  expect((await fetch(`http://127.0.0.1:${value}/`)).status).toBe(200);
  server.removeAllListeners("request");
  server.on("request", (_req, res) => {
    res.statusCode = 503;
    res.end("unavailable");
  });
  await expect(startPreview(report, stateDir)).rejects.toThrow("占用");
  expect((await previewStatus(report, stateDir)).state).toBe("failed");
  expect(workspacePreviewTask()).toBeNull();
});
it("changes preview retention on subsequent appends without trimming immediately", async () => {
  const { report, stateDir, save } = await fixture();
  const value = await port();
  await save("project", "preview", { port: value });
  await startPreview(report, stateDir);
  await vi.waitFor(
    async () => expect((await previewStatus(report, stateDir)).state).toBe("running"),
    { timeout: 10000 },
  );
  await fetch(`http://127.0.0.1:${value}/logs`);
  await vi.waitFor(async () =>
    expect((await previewStatus(report, stateDir)).logs.length).toBeGreaterThan(100),
  );
  updateLogRetention(await save("machine", "logs", { preview: 100 }), stateDir);
  expect((await previewStatus(report, stateDir)).logs.length).toBeGreaterThan(100);
  await fetch(`http://127.0.0.1:${value}/logs`);
  await vi.waitFor(async () =>
    expect((await previewStatus(report, stateDir)).logs).toHaveLength(100),
  );
}, 15000);
it("remembers only type/scope after an explicit successful commit and preserves updated defaults", async () => {
  const { report, stateDir, root, save } = await fixture();
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  git("init");
  git("config", "user.name", "Task Test");
  git("config", "user.email", "test@example.invalid");
  git("add", "src");
  git("commit", "-m", "chore: initial");
  await save("project", "publish", { remember: true, type: "docs", scope: "" });
  const baseline = await taskPreferences(report, stateDir);
  await writeFile(path.join(root, "src/content/posts/one.md"), "# Updated\n");
  const message = "fix(posts): update article\n\nprivate description";
  await commitSelected(report, ["src/content/posts/one.md"], message);
  expect(await rememberPublishDefaults(report, baseline, message, stateDir)).toBeNull();
  const current = await taskPreferences(report, stateDir);
  expect(current.publish).toEqual({ remember: true, type: "fix", scope: "posts" });
  const raw = await readFile(
    path.join(stateDir, "project-settings", current.key + ".json"),
    "utf8",
  );
  expect(raw).not.toContain("private description");
  expect(raw).not.toContain("one.md");
  await save("project", "publish", { type: "test" });
  expect(
    await rememberPublishDefaults(report, current, "docs(content): changed", stateDir),
  ).toContain("未覆盖");
  expect((await taskPreferences(report, stateDir)).publish.type).toBe("test");
  await save("project", "publish", { remember: false });
  const disabled = await taskPreferences(report, stateDir);
  const before = await readdir(stateDir);
  expect(await rememberPublishDefaults(report, disabled, "chore: noop", stateDir)).toBeNull();
  expect((await taskPreferences(report, stateDir)).snapshot.version).toBe(
    disabled.snapshot.version,
  );
  expect(await readdir(stateDir)).toEqual(before);
});
it("bounds publish logs with saved machine preferences during real fixture operations", async () => {
  const { report, stateDir, root, save } = await fixture();
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ scripts: { build: "node task.mjs" } }),
  );
  await writeFile(path.join(root, "task.mjs"), "for(let i=0;i<350;i++)console.log('fixture '+i);");
  execFileSync("git", ["-C", root, "init"]);
  await save("machine", "logs", { publish: 100 });
  await readLogRetention(stateDir);
  await startPublishOperation(report, "build", stateDir);
  await vi.waitFor(() => expect(publishOperationStatus(report).state).toBe("succeeded"), {
    timeout: 20000,
    interval: 100,
  });
  expect(publishOperationStatus(report).logs).toHaveLength(100);
  expect(publishOperationStatus(report).logLimit).toBe(100);
}, 25000);
it("isolates project defaults, preserves unrelated groups, and does not rewrite unchanged remembered fields", async () => {
  const first = await fixture();
  const second = await fixture();
  await first.save("project", "publish", { remember: true, type: "fix", scope: "posts" });
  const baseline = await taskPreferences(first.report, first.stateDir);
  expect((await taskPreferences(second.report, second.stateDir)).publish.remember).toBe(false);
  expect(
    await rememberPublishDefaults(
      second.report,
      baseline,
      "docs: different project",
      second.stateDir,
    ),
  ).toContain("未覆盖");
  expect(
    await rememberPublishDefaults(
      first.report,
      baseline,
      "fix(posts): another body",
      first.stateDir,
    ),
  ).toBeNull();
  expect((await taskPreferences(first.report, first.stateDir)).snapshot.version).toBe(
    baseline.snapshot.version,
  );
  await first.save("project", "preview", { path: "/about/" });
  expect(
    await rememberPublishDefaults(first.report, baseline, "docs: changed type", first.stateDir),
  ).toBeNull();
  const latest = await taskPreferences(first.report, first.stateDir);
  expect(latest.preview.path).toBe("/about/");
  expect(latest.publish.type).toBe("docs");
  expect(latest.publish.scope).toBe("");
});
it("reports a preference-save failure without altering a future settings document", async () => {
  const { report, stateDir, save } = await fixture();
  await save("project", "publish", { remember: true });
  const baseline = await taskPreferences(report, stateDir);
  const file = path.join(stateDir, "project-settings", baseline.key + ".json");
  const future = { ...baseline.snapshot.document, schemaVersion: 99 };
  await writeFile(file, JSON.stringify(future));
  const before = await readFile(file, "utf8");
  expect(
    await rememberPublishDefaults(report, baseline, "fix(content): committed", stateDir),
  ).toContain("未保存");
  expect(await readFile(file, "utf8")).toBe(before);
});
