import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import { loginCookie } from "./auth-fixture";
import { saveWorkspacePath } from "../src/lib/server/workspace";

const directories: string[] = [];
const originalToken = process.env.PANEL_ACCESS_TOKEN;
const origin = "http://127.0.0.1:4173";
afterEach(async () => {
  if (originalToken === undefined) delete process.env.PANEL_ACCESS_TOKEN;
  else process.env.PANEL_ACCESS_TOKEN = originalToken;
  for (const root of directories.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-workspace-route-"));
  directories.push(root);
  const projects = await Promise.all(
    ["one", "two"].map(async (name) => {
      const directory = path.join(root, name);
      await mkdir(path.join(directory, "src/config"), { recursive: true });
      await mkdir(path.join(directory, "src/content/posts"), { recursive: true });
      await mkdir(path.join(directory, "scripts"));
      await writeFile(
        path.join(directory, "package.json"),
        JSON.stringify({ name: "mizuki", dependencies: { astro: "7" } }),
      );
      await writeFile(path.join(directory, "src/content.config.ts"), "");
      await writeFile(path.join(directory, "src/config/index.ts"), "");
      await writeFile(path.join(directory, "scripts/sync-content.js"), "");
      await writeFile(path.join(directory, ".env"), "ENABLE_CONTENT_SYNC=false\n");
      await writeFile(
        path.join(directory, "src/content/posts/one.md"),
        "---\ntitle: 测试\npublished: 2026-10-09\ndraft: true\n---\n\nOriginal\n",
      );
      return directory;
    }),
  );
  const stateDir = path.join(root, "state");
  await saveWorkspacePath(projects[0], stateDir);
  process.env.PANEL_ACCESS_TOKEN = "workspace-test";
  const app = createApp({ expectedOrigin: origin, stateDir });
  const headers = {
    cookie: await loginCookie(app, "workspace-test"),
    origin,
    "content-type": "application/json",
  };
  const get = async (route: string, version?: string) =>
    app.request(origin + route, {
      headers: { ...headers, ...(version ? { "x-mizuki-workspace": version } : {}) },
    });
  const mutate = async (route: string, body: unknown, version: string, method = "POST") =>
    app.request(origin + route, {
      method,
      headers: { ...headers, "x-mizuki-workspace": version },
      body: JSON.stringify(body),
    });
  return { stateDir, app, projects, get, mutate, headers };
}
it("rejects cross-tab writes after switching even when article names and file versions match", async () => {
  const { projects, get, mutate } = await fixture();
  const old = await (await get("/api/workspace")).json();
  const article = await (await get("/api/article?id=one.md", old.version)).json();
  const switched = await mutate(
    "/api/workspace/connect",
    { projectPath: projects[1], version: old.version },
    old.version,
  );
  expect(switched.status).toBe(200);
  const next = await switched.json();
  const stale = await mutate(
    "/api/article/body",
    { id: "one.md", body: "wrong project", version: article.article.version },
    old.version,
    "PUT",
  );
  expect(stale.status).toBe(409);
  expect((await stale.json()).message).toContain("未将修改写入其他项目");
  expect((await get("/api/article?id=one.md", old.version)).status).toBe(409);
  expect((await get("/api/workspace", old.version)).status).toBe(200);
  expect(
    (await mutate("/api/workspace/disconnect", { version: old.version }, next.version)).status,
  ).toBe(409);
  expect(await readFile(path.join(projects[1], "src/content/posts/one.md"), "utf8")).toContain(
    "Original",
  );
});
it("enforces project read-only for every write domain while allowing scoped panel preference saves", async () => {
  const { projects, get, mutate } = await fixture();
  const workspace = await (await get("/api/workspace")).json();
  let settings = await (await get("/api/settings", workspace.version)).json();
  expect(
    (
      await mutate(
        "/api/settings",
        {
          scope: "project",
          group: "access",
          fields: { readOnly: true },
          projectKey: settings.project.key,
          version: null,
        },
        workspace.version,
        "PATCH",
      )
    ).status,
  ).toBe(200);
  const report = await (await get("/api/workspace")).json();
  expect(report.report.readOnly).toBe(true);
  expect(report.report.preferenceReadOnly).toBe(true);
  expect((await get("/api/articles", workspace.version)).status).toBe(200);
  const cases: [string, string, unknown][] = [
    ["PUT", "/api/article/body", { id: "one.md", body: "changed", version: "old" }],
    ["PUT", "/api/config", { key: "siteConfig", initializer: "{}", version: "old" }],
    ["DELETE", "/api/media", { scope: "public", path: "one.png" }],
    ["PUT", "/api/feature/text", { key: "aboutText", content: "changed", version: "old" }],
    [
      "POST",
      "/api/publish/commit",
      { paths: ["src/content/posts/one.md"], message: "feat(content): test" },
    ],
    ["POST", "/api/publish/push", {}],
    ["POST", "/api/publish/revert", {}],
    ["POST", "/api/publish/operation", { kind: "validate" }],
  ];
  for (const [method, route, body] of cases) {
    const response = await mutate(route, body, workspace.version, method);
    expect(response.status, route).toBe(400);
    expect((await response.json()).message, route).toContain("只读");
  }
  settings = await (await get("/api/settings", workspace.version)).json();
  expect(
    (
      await mutate(
        "/api/settings",
        {
          scope: "project",
          group: "access",
          fields: { readOnly: false },
          projectKey: settings.project.key,
          version: settings.project.settings.version,
        },
        workspace.version,
        "PATCH",
      )
    ).status,
  ).toBe(200);
  expect((await (await get("/api/workspace")).json()).report.readOnly).toBe(false);
  expect(await readFile(path.join(projects[0], "src/content/posts/one.md"), "utf8")).toContain(
    "Original",
  );
});
it("validates default identities, exposes versioned removal and requires connection versions", async () => {
  const { get, mutate, projects } = await fixture();
  const workspace = await (await get("/api/workspace")).json();
  expect(
    (await mutate("/api/workspace/connect", { projectPath: projects[1] }, workspace.version))
      .status,
  ).toBe(400);
  expect(
    (
      await mutate(
        "/api/settings",
        {
          scope: "machine",
          group: "workspace",
          fields: { defaultProject: "a".repeat(64) },
          version: null,
        },
        workspace.version,
        "PATCH",
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await mutate(
        "/api/settings",
        {
          scope: "machine",
          group: "workspace",
          fields: { defaultProject: workspace.recentProjects[0].id },
          version: null,
        },
        workspace.version,
        "PATCH",
      )
    ).status,
  ).toBe(200);
  const removed = await mutate(
    "/api/workspace/recent/remove",
    { id: workspace.recentProjects[0].id, version: workspace.historyVersion },
    workspace.version,
  );
  expect(removed.status).toBe(200);
  const after = await removed.json();
  expect(after.recentProjects).toEqual([]);
  expect(after.defaultProject.id).toBe(workspace.recentProjects[0].id);
  expect(
    (
      await mutate(
        "/api/workspace/recent/remove",
        { id: workspace.recentProjects[0].id, version: workspace.historyVersion },
        workspace.version,
      )
    ).status,
  ).toBe(409);
});
it("requires a view token for writes and serializes an in-flight save before a project switch", async () => {
  const { app, projects, get, mutate, headers } = await fixture();
  const workspace = await (await get("/api/workspace")).json();
  const article = await (await get("/api/article?id=one.md", workspace.version)).json();
  expect(
    (
      await app.request(origin + "/api/article/body", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          id: "one.md",
          body: "missing view",
          version: article.article.version,
        }),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await app.request(origin + "/api/workspace/connect", {
        method: "POST",
        headers: { ...headers, "x-mizuki-workspace": workspace.version },
        body: "{ invalid",
      })
    ).status,
  ).toBe(400);
  const [saved, switched] = await Promise.all([
    mutate(
      "/api/article/body",
      { id: "one.md", body: "Saved in first project\n", version: article.article.version },
      workspace.version,
      "PUT",
    ),
    mutate(
      "/api/workspace/connect",
      { projectPath: projects[1], version: workspace.version },
      workspace.version,
    ),
  ]);
  expect(saved.status).toBe(200);
  expect(switched.status).toBe(200);
  expect(await readFile(path.join(projects[0], "src/content/posts/one.md"), "utf8")).toContain(
    "Saved in first project",
  );
  expect(await readFile(path.join(projects[1], "src/content/posts/one.md"), "utf8")).toContain(
    "Original",
  );
});
