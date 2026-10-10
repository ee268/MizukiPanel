import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import { SESSION_COOKIE } from "../src/lib/server/auth";
import { workspaceSession } from "../src/lib/server/workspace-session";
import { readPanelSettings, savePanelSettingsGroups } from "../src/lib/server/panel-settings";
const roots: string[] = [];
const original = process.env.PANEL_ACCESS_TOKEN;
afterEach(async () => {
  if (original === undefined) delete process.env.PANEL_ACCESS_TOKEN;
  else process.env.PANEL_ACCESS_TOKEN = original;
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
it("protects import and maintenance routes and binds each atomic scope save to workspace and settings versions", async () => {
  const state = await mkdtemp(path.join(tmpdir(), "mizuki-preferences-api-"));
  roots.push(state);
  process.env.PANEL_ACCESS_TOKEN = "transfer-test";
  const origin = "http://127.0.0.1:4173";
  const app = createApp({ stateDir: state, expectedOrigin: origin });
  const session = workspaceSession(state);
  await session.initialize();
  const headers = {
    origin,
    cookie: `${SESSION_COOKIE}=transfer-test`,
    "content-type": "application/json",
    "x-mizuki-workspace": session.version,
  };
  const input = {
    scope: "machine",
    groups: { logs: { preview: 350 }, maintenance: { days: 90 } },
    version: null,
  };
  const post = (body: unknown, h = headers) =>
    app.request(`${origin}/api/settings/import`, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
  expect((await post(input, { ...headers, cookie: "" })).status).toBe(401);
  expect((await post(input, { ...headers, origin: "https://untrusted.example" })).status).toBe(403);
  expect((await post(input, { ...headers, "x-mizuki-workspace": "stale" })).status).toBe(409);
  expect((await post(input)).status).toBe(200);
  expect((await post(input)).status).toBe(409);
  const saved = await readPanelSettings("machine", undefined, state);
  expect(saved.document.values.logs.preview).toBe(350);
  expect(saved.document.values.maintenance.days).toBe(90);
  expect(
    (
      await post({
        ...input,
        groups: { logs: { preview: 360 }, maintenance: { count: 0 } },
        version: saved.version,
      })
    ).status,
  ).toBe(400);
  expect((await readPanelSettings("machine", undefined, state)).version).toBe(saved.version);
  expect((await app.request(`${origin}/api/maintenance`, { headers })).status).toBe(200);
  expect((await app.request(`${origin}/api/maintenance`)).status).toBe(401);
  expect(
    (
      await app.request(`${origin}/api/maintenance/cleanup`, {
        method: "POST",
        headers,
        body: JSON.stringify({ token: "fake", ids: ["../outside"] }),
      })
    ).status,
  ).toBe(409);
});
it("validates all project groups before writing and preserves successful independent ranges", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-preferences-bulk-"));
  roots.push(root);
  const state = path.join(root, "state");
  await mkdir(state);
  const key = "a".repeat(64);
  const machine = await savePanelSettingsGroups(
    { scope: "machine", groups: { logs: { preview: 355 } }, version: null },
    state,
  );
  await expect(
    savePanelSettingsGroups(
      {
        scope: "project",
        projectKey: key,
        version: null,
        groups: { preview: { port: 4400 }, articleTemplate: { frontmatter: "not: [valid" } },
      },
      state,
    ),
  ).rejects.toThrow("无效");
  expect((await readPanelSettings("project", key, state)).version).toBeNull();
  expect((await readPanelSettings("machine", undefined, state)).version).toBe(machine.version);
  const project = await savePanelSettingsGroups(
    {
      scope: "project",
      projectKey: key,
      version: null,
      groups: { preview: { port: 4400 }, publish: { scope: "docs" } },
    },
    state,
  );
  expect(project.document.values.publish.scope).toBe("docs");
  expect(project.document.values.preview.port).toBe(4400);
  expect(await readFile(path.join(state, "settings.json"), "utf8")).toContain("355");
});
