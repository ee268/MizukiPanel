import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Hono } from "hono";
import { afterEach, expect, it, vi } from "vitest";
import { loginCookie } from "./auth-fixture";
import { registerAuthRoutes } from "../src/server/routes/auth";
import { PanelSessions } from "../src/lib/server/panel-sessions";
import { saveWorkspacePath } from "../src/lib/server/workspace";
import type { ProjectReport } from "../src/lib/server/project";
import { currentProject } from "../src/server/project";
import { ApiError } from "../src/server/errors";
import { registerSecurityMiddleware } from "../src/server/middleware";
import { registerSettingsRoutes } from "../src/server/routes/settings";
import * as settingsService from "../src/lib/server/panel-settings";
import { workspaceSession } from "../src/lib/server/workspace-session";

vi.mock("../src/server/project", () => ({ currentProject: vi.fn() }));
const roots: string[] = [];
const originalToken = process.env.PANEL_ACCESS_TOKEN;
const origin = "http://127.0.0.1:4173";
afterEach(async () => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  if (originalToken === undefined) delete process.env.PANEL_ACCESS_TOKEN;
  else process.env.PANEL_ACCESS_TOKEN = originalToken;
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-settings-route-"));
  roots.push(root);
  const state = path.join(root, "state");
  const app = new Hono();
  process.env.PANEL_ACCESS_TOKEN = "settings-route-test";
  registerSecurityMiddleware(app, origin, new PanelSessions(state));
  registerAuthRoutes(app);
  registerSettingsRoutes(app, state);
  app.onError((error, context) =>
    context.json({ message: error.message }, error instanceof ApiError ? error.status : 500),
  );
  const headers = {
    cookie: await loginCookie(app, "settings-route-test"),
    origin,
    "content-type": "application/json",
  };
  return { root, state, app, headers };
}
it("protects settings routes and supports no-project reads, validation and conflicts", async () => {
  const { app, headers } = await fixture();
  expect((await app.request(`${origin}/api/settings`)).status).toBe(401);
  const initial = await (await app.request(`${origin}/api/settings`, { headers })).json();
  expect(initial.project).toBeNull();
  expect(initial.machine.version).toBeNull();
  const payload = {
    scope: "machine",
    group: "workspace",
    fields: { recentLimit: 12 },
    version: null,
  };
  const request = { method: "PATCH", headers, body: JSON.stringify(payload) };
  expect(
    (
      await app.request(`${origin}/api/settings`, {
        ...request,
        headers: { ...headers, origin: "https://other.example" },
      })
    ).status,
  ).toBe(403);
  expect((await app.request(`${origin}/api/settings`, request)).status).toBe(200);
  expect((await app.request(`${origin}/api/settings`, request)).status).toBe(409);
  expect(
    (
      await app.request(`${origin}/api/settings`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          scope: "browser",
          group: "appearance",
          fields: { hue: 12 },
          version: null,
        }),
      })
    ).status,
  ).toBe(400);
  const current = await (await app.request(`${origin}/api/settings`, { headers })).json();
  expect(
    (
      await app.request(`${origin}/api/settings`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          ...payload,
          fields: { unknown: true },
          version: current.machine.version,
        }),
      })
    ).status,
  ).toBe(400);
});
it("rejects saves aimed at another project and permits panel preferences for a read-only project", async () => {
  const { app, root, state, headers } = await fixture();
  const projectRoot = path.join(root, "project");
  await mkdir(projectRoot);
  await saveWorkspacePath(projectRoot, state);
  vi.spyOn(workspaceSession(state), "active").mockResolvedValue(projectRoot);
  const report: ProjectReport = {
    root: projectRoot,
    requestedPath: projectRoot,
    mode: "local",
    readOnly: true,
    contentRoot: null,
    warnings: [],
    mappings: [],
  };
  vi.mocked(currentProject).mockResolvedValue(report);
  const initial = await (await app.request(`${origin}/api/settings`, { headers })).json();
  const body = {
    scope: "project",
    projectKey: "wrong-project",
    group: "media",
    fields: { scope: "article" },
    version: null,
  };
  expect(
    (
      await app.request(`${origin}/api/settings`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await app.request(`${origin}/api/settings`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ ...body, projectKey: initial.project.key }),
      })
    ).status,
  ).toBe(200);
  expect(await readdir(projectRoot)).toEqual([]);
  const after = await (await app.request(`${origin}/api/settings`, { headers })).json();
  expect(after.project.settings.document.values.media.scope).toBe("article");
  const second = path.join(root, "second-project");
  await mkdir(second);
  await saveWorkspacePath(second, state);
  vi.mocked(currentProject).mockResolvedValue({ ...report, root: second, requestedPath: second });
  const stale = await app.request(`${origin}/api/settings`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      ...body,
      projectKey: initial.project.key,
      version: after.project.settings.version,
    }),
  });
  expect(stale.status).toBe(409);
  expect(await readdir(second)).toEqual([]);
});
it("reports an unwritable settings directory without claiming success", async () => {
  const { app, headers } = await fixture();
  vi.spyOn(settingsService, "savePanelSettings").mockRejectedValue(
    Object.assign(new Error("access denied"), { code: "EACCES" }),
  );
  const response = await app.request(`${origin}/api/settings`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      scope: "machine",
      group: "workspace",
      fields: { recentLimit: 20 },
      version: null,
    }),
  });
  expect(response.status).toBe(403);
  expect((await response.json()).message).toContain("输入已保留");
});
