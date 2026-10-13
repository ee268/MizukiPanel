import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import { loginCookie } from "./auth-fixture";
import { emptyDocument } from "../src/shared/panel-settings";
import { MaintenanceStore } from "../src/lib/server/maintenance";

const roots: string[] = [];
const originalToken = process.env.PANEL_ACCESS_TOKEN;
const origin = "http://127.0.0.1:4173";
afterEach(async () => {
  if (originalToken === undefined) delete process.env.PANEL_ACCESS_TOKEN;
  else process.env.PANEL_ACCESS_TOKEN = originalToken;
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const state = await mkdtemp(path.join(tmpdir(), "mizuki-personal-settings-"));
  roots.push(state);
  process.env.PANEL_ACCESS_TOKEN = "personal-settings-fixture";
  const app = createApp({ stateDir: state, expectedOrigin: origin });
  const headers = {
    cookie: await loginCookie(app, "personal-settings-fixture"),
    origin,
    "content-type": "application/json",
  };
  const request = (route: string, method = "GET", body?: unknown, custom = headers) =>
    app.request(origin + route, {
      method,
      headers: custom,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { state, app, headers, request };
}
it("persists autosave in .local-style disk preferences across browsers and indexes its backup", async () => {
  const { state, request } = await fixture();
  const initial = await (
    await request("/api/settings/personal/initialize", "POST", {
      groups: emptyDocument("browser").values,
    })
  ).json();
  const fields = { enabled: true, scope: "both", trigger: "both", intervalSeconds: 30 };
  const updated = await request("/api/settings/personal", "PUT", {
    patches: { articleAutosave: { fields, base: initial.document.values.articleAutosave } },
  });
  expect(updated.status).toBe(200);
  const otherBrowser = await request("/api/settings/personal/initialize", "POST", {
    groups: emptyDocument("browser").values,
  });
  expect((await otherBrowser.json()).document.values.articleAutosave).toEqual(fields);
  expect(
    JSON.parse(await readFile(path.join(state, "personal-settings.json"), "utf8")).values
      .articleAutosave,
  ).toEqual(fields);
  expect(
    (await new MaintenanceStore(state).inventory(null)).items.some(
      (item) => item.domain === "settings" && item.kind === "backup",
    ),
  ).toBe(true);
});
it("shares disk preferences across browsers, imports only once and keeps per-group conflicts", async () => {
  const { state, app, request } = await fixture();
  expect((await app.request(origin + "/api/settings/personal")).status).toBe(401);
  const first = emptyDocument("browser");
  first.values.appearance.font = "system";
  first.values.editor.outline = true;
  const initial = await request("/api/settings/personal/initialize", "POST", {
    groups: first.values,
  });
  expect(initial.status).toBe(200); // No connected project or workspace header required.
  expect(initial.headers.get("cache-control")).toBe("no-store");
  const baseline = await initial.json();
  const secondBrowser = await request("/api/settings/personal/initialize", "POST", {
    groups: emptyDocument("browser").values,
  });
  expect(await secondBrowser.json()).toEqual(baseline);
  const update = await request("/api/settings/personal", "PUT", {
    patches: { appearance: { fields: { hue: 91 }, base: baseline.document.values.appearance } },
  });
  expect(update.status).toBe(200);
  expect(
    (await (await request("/api/settings/personal")).json()).document.values.appearance,
  ).toMatchObject({ font: "system", hue: 91 });
  expect(
    (
      await request("/api/settings/personal", "PUT", {
        patches: { appearance: { fields: { hue: 92 }, base: baseline.document.values.appearance } },
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request("/api/settings/personal", "PUT", {
        patches: { logs: { fields: { autoScroll: false }, base: baseline.document.values.logs } },
      })
    ).status,
  ).toBe(200);
  expect(
    JSON.parse(await readFile(path.join(state, "personal-settings.json"), "utf8")).values.logs
      .autoScroll,
  ).toBe(false);
  expect(
    (await readdir(path.join(state, "backups/settings"))).filter((name) => name.endsWith(".bak")),
  ).toHaveLength(2);
  const freshServer = createApp({ stateDir: state, expectedOrigin: origin });
  const cookie = await loginCookie(freshServer, "personal-settings-fixture");
  const restarted = await freshServer.request(origin + "/api/settings/personal", {
    headers: { cookie },
  });
  expect((await restarted.json()).document.values.appearance.font).toBe("system");
});
it("protects disk saves from foreign origins and secret fields, and restores preference backups", async () => {
  const { request, headers, state } = await fixture();
  await request("/api/settings/personal/initialize", "POST", {});
  expect(
    (
      await request("/api/settings/personal", "PUT", {
        patches: { ai: { fields: { apiKey: "should-not-persist" } } },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(
        "/api/settings/personal",
        "PUT",
        { patches: { appearance: { fields: { hue: 45 } } } },
        { ...headers, origin: "https://foreign.example" },
      )
    ).status,
  ).toBe(403);
  await request("/api/settings/personal", "PUT", {
    patches: { appearance: { fields: { hue: 45 } } },
  });
  const store = new MaintenanceStore(state);
  const backup = (await store.inventory(null)).items.find(
    (item) => item.originalPath === "personal-settings.json",
  )!;
  expect(backup.restorable).toBe(true);
  const preview = await store.restorePreview(backup.id, null);
  await store.restore(preview.token, null);
  const restored = await (await request("/api/settings/personal")).json();
  expect(restored.document.values.appearance.hue).toBe(
    emptyDocument("browser").values.appearance.hue,
  );
  expect((await store.inventory(null)).items).toHaveLength(2);
});

it("backs up malformed preferences before recovery and refuses to reset a future schema", async () => {
  const { request, state } = await fixture();
  const file = path.join(state, "personal-settings.json");
  await writeFile(file, "{broken settings");
  const broken = await (await request("/api/settings/personal")).json();
  expect(broken.readOnly).toBe(true);
  expect(
    (await request("/api/settings/personal/recover", "POST", { version: "stale" })).status,
  ).toBe(409);
  expect(
    (await request("/api/settings/personal/recover", "POST", { version: broken.version })).status,
  ).toBe(200);
  const backups = (await readdir(path.join(state, "backups/settings"))).filter((name) =>
    name.endsWith(".bak"),
  );
  expect(await readFile(path.join(state, "backups/settings", backups[0]), "utf8")).toBe(
    "{broken settings",
  );
  const future = { ...emptyDocument("browser"), schemaVersion: 999 };
  await writeFile(file, JSON.stringify(future));
  const current = await (await request("/api/settings/personal")).json();
  expect(
    (await request("/api/settings/personal/recover", "POST", { version: current.version })).status,
  ).toBe(400);
  expect(JSON.parse(await readFile(file, "utf8")).schemaVersion).toBe(999);
}, 15000);
