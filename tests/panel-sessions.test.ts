import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { PanelSessions } from "../src/lib/server/panel-sessions";
import { createApp } from "../src/server/app";
import { loginCookie } from "./auth-fixture";
import { SESSION_COOKIE } from "../src/lib/server/auth";
import { savePanelSettings, readPanelSettings } from "../src/lib/server/panel-settings";
import { serializeWorkspaceMutation, workspaceSession } from "../src/lib/server/workspace-session";
const roots: string[] = [];
const token = process.env.PANEL_ACCESS_TOKEN;
const origin = "http://127.0.0.1:4173";
afterEach(async () => {
  vi.restoreAllMocks();
  if (token === undefined) delete process.env.PANEL_ACCESS_TOKEN;
  else process.env.PANEL_ACCESS_TOKEN = token;
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const state = await mkdtemp(path.join(tmpdir(), "mizuki-panel-sessions-"));
  roots.push(state);
  let now = Date.parse("2026-10-10T08:00:00Z");
  process.env.PANEL_ACCESS_TOKEN = "panel-sessions-test";
  const sessions = new PanelSessions(state, () => now);
  const app = createApp({ stateDir: state, expectedOrigin: origin, sessions });
  const policy = async (fields: Record<string, unknown>) =>
    savePanelSettings(
      {
        scope: "machine",
        group: "session",
        fields,
        version: (await readPanelSettings("machine", undefined, state)).version,
      },
      state,
    );
  const request = (
    cookie: string,
    route = "/api/session",
    method = "GET",
    body?: unknown,
    extra = {},
  ) =>
    app.request(origin + route, {
      method,
      headers: { cookie, origin, "content-type": "application/json", ...extra },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  return {
    state,
    sessions,
    app,
    policy,
    request,
    advance: (duration: number) => {
      now += duration;
    },
    now: () => now,
  };
}
it("mints independent opaque IDs, rejects raw tokens and does not time out by default", async () => {
  const f = await fixture();
  const first = await f.sessions.create();
  const second = await f.sessions.create();
  expect(first.id).not.toBe(second.id);
  expect(first.id).not.toBe(process.env.PANEL_ACCESS_TOKEN);
  expect(first.status.key).not.toBe(first.id);
  expect(await f.sessions.verify(process.env.PANEL_ACCESS_TOKEN)).toEqual({ reason: "invalid" });
  expect(await f.sessions.verify(first.status.key)).toEqual({ reason: "invalid" });
  f.advance(365 * 86400000);
  expect(await f.sessions.verify(first.id)).toMatchObject({
    status: { authenticated: true, expiresAt: null, lastActivityAt: first.status.lastActivityAt },
  });
});
it("does not count reads or polling as activity and cannot revive an expired session", async () => {
  const f = await fixture();
  await f.policy({ idleEnabled: true, idleMinutes: 5 });
  const cookie = await loginCookie(f.app, "panel-sessions-test");
  const first = await (await f.request(cookie)).json();
  for (let n = 0; n < 5; n++) {
    f.advance(60000);
    const response = await f.request(cookie);
    if (n < 4) {
      expect(response.status).toBe(200);
      expect((await response.json()).lastActivityAt).toBe(first.lastActivityAt);
    } else {
      expect(response.status).toBe(401);
      expect((await response.json()).reason).toBe("idle");
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  }
  expect((await f.request(cookie, "/api/auth/activity", "POST")).status).toBe(401);
  await f.policy({ idleEnabled: false });
  expect((await f.request(cookie)).status).toBe(401);
});
it("records server time for explicit activity, shares it across tabs, and caps active sessions at maximum age", async () => {
  const f = await fixture();
  await f.policy({ idleEnabled: true, idleMinutes: 5, maximumEnabled: true, maximumHours: 1 });
  const cookie = await loginCookie(f.app, "panel-sessions-test");
  for (let n = 0; n < 14; n++) {
    f.advance(4 * 60000);
    const r = await f.request(cookie, "/api/auth/activity", "POST", { timestamp: "2099-01-01" });
    expect(r.status).toBe(200);
    expect((await r.json()).lastActivityAt).toBe(new Date(f.now()).toISOString());
    expect((await f.request(cookie)).status).toBe(200);
  }
  f.advance(4 * 60000);
  const response = await f.request(cookie);
  expect(response.status).toBe(401);
  expect((await response.json()).reason).toBe("maximum");
});
it("rejects cross-origin activity and applies shortened policies on the next request", async () => {
  const f = await fixture();
  const cookie = await loginCookie(f.app, "panel-sessions-test");
  const first = await (await f.request(cookie)).json();
  f.advance(6 * 60000);
  expect(
    (await f.request(cookie, "/api/auth/activity", "POST", {}, { origin: "https://other.example" }))
      .status,
  ).toBe(403);
  expect((await (await f.request(cookie)).json()).lastActivityAt).toBe(first.lastActivityAt);
  await f.policy({ idleEnabled: true, idleMinutes: 5 });
  expect((await f.request(cookie)).status).toBe(401);
  const fresh = await loginCookie(f.app, "panel-sessions-test");
  expect((await f.request(fresh)).status).toBe(200);
});
it("revokes only the submitted session at logout, rejects replay, and replaces the current ID on login", async () => {
  const f = await fixture();
  const first = await loginCookie(f.app, "panel-sessions-test");
  const other = await loginCookie(f.app, "panel-sessions-test");
  const login = await f.request(first, "/api/auth/login", "POST", { token: "panel-sessions-test" });
  const fresh = login.headers.get("set-cookie")!.split(";")[0];
  expect(fresh).not.toBe(first);
  expect((await f.request(first)).status).toBe(401);
  expect((await f.request(fresh)).status).toBe(200);
  expect((await f.request(other)).status).toBe(200);
  expect((await f.request(fresh, "/api/auth/logout", "POST")).status).toBe(200);
  expect((await f.request(fresh)).status).toBe(401);
  expect((await f.request(other)).status).toBe(200);
});
it("isolates service instances, rejects legacy cookies after restart and invalidates token rotations", async () => {
  const f = await fixture();
  const created = await f.sessions.create();
  const restarted = new PanelSessions(f.state, () => f.now());
  expect(await restarted.verify(created.id)).toEqual({ reason: "invalid" });
  expect((await f.request(`${SESSION_COOKIE}=panel-sessions-test`)).status).toBe(401);
  const another = await fixture();
  expect(await another.sessions.verify(created.id)).toEqual({ reason: "invalid" });
  process.env.PANEL_ACCESS_TOKEN = "rotated";
  expect(await f.sessions.verify(created.id)).toEqual({ reason: "invalid" });
});
it("fails closed for future or invalid policies and leaves the setting file untouched", async () => {
  const f = await fixture();
  const cookie = await loginCookie(f.app, "panel-sessions-test");
  const filename = path.join(f.state, "settings.json");
  for (const raw of [
    "{ broken",
    JSON.stringify({ schemaVersion: 2, values: {} }),
    JSON.stringify({ schemaVersion: 1, values: { session: { idleMinutes: 1 } } }),
  ]) {
    await writeFile(filename, raw);
    expect((await f.request(cookie)).status).toBe(503);
    expect(
      (await f.request("", "/api/auth/login", "POST", { token: "panel-sessions-test" })).status,
    ).toBe(503);
    expect(await readFile(filename, "utf8")).toBe(raw);
  }
});
it("rejects an activity report revoked while the policy read is pending", async () => {
  const f = await fixture();
  const created = await f.sessions.create();
  const policy = await f.sessions.policy();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.spyOn(f.sessions, "policy").mockImplementation(async () => {
    await gate;
    return policy;
  });
  const activity = f.sessions.activity(created.id);
  f.sessions.revoke(created.id);
  release();
  expect(await activity).toEqual({ reason: "invalid" });
  expect(await f.sessions.verify(created.id)).toEqual({ reason: "invalid" });
});
it("validates duration bounds and never writes invalid policy values", async () => {
  const f = await fixture();
  for (const fields of [
    { idleMinutes: 4 },
    { idleMinutes: 241 },
    { maximumHours: 0 },
    { maximumHours: 169 },
    { idleEnabled: "true" },
  ])
    await expect(f.policy(fields)).rejects.toThrow("无效");
  expect((await readPanelSettings("machine", undefined, f.state)).version).toBeNull();
});
it("rechecks authentication after a workspace mutation has waited in the queue", async () => {
  const f = await fixture();
  await f.policy({ idleEnabled: true, idleMinutes: 5 });
  const cookie = await loginCookie(f.app, "panel-sessions-test");
  await workspaceSession(f.state).initialize();
  const version = workspaceSession(f.state).version;
  const verify = vi.spyOn(f.sessions, "verify");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const blocker = serializeWorkspaceMutation(() => gate);
  const raw = await readFile(path.join(f.state, "settings.json"), "utf8");
  const response = f.request(
    cookie,
    "/api/settings",
    "PATCH",
    {
      scope: "machine",
      group: "logs",
      fields: { preview: 333 },
      version: (await readPanelSettings("machine", undefined, f.state)).version,
    },
    { "x-mizuki-workspace": version },
  );
  await new Promise((resolve) => setImmediate(resolve));
  expect(verify).not.toHaveBeenCalled();
  f.advance(5 * 60000);
  release();
  await blocker;
  expect((await response).status).toBe(401);
  expect(await readFile(path.join(f.state, "settings.json"), "utf8")).toBe(raw);
});
it("allows independent sessions to continue without exposing IDs or credentials in preference reads", async () => {
  const f = await fixture();
  const first = await loginCookie(f.app, "panel-sessions-test");
  f.advance(60000);
  const second = await loginCookie(f.app, "panel-sessions-test");
  await f.policy({ idleEnabled: true, idleMinutes: 5 });
  f.advance(4 * 60000);
  expect((await f.request(first)).status).toBe(401);
  expect((await f.request(second)).status).toBe(200);
  const data = JSON.stringify(await (await f.request(second, "/api/settings")).json());
  expect(data).not.toContain(first);
  expect(data).not.toContain(second);
  expect(data).not.toContain("panel-sessions-test");
});
