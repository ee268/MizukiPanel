import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import { saveWorkspacePath } from "../src/lib/server/workspace";
import { loginCookie } from "./auth-fixture";
const directories: string[] = [],
  token = process.env.PANEL_ACCESS_TOKEN;
const origin = "http://127.0.0.1:4173";
afterEach(async () => {
  if (token === undefined) delete process.env.PANEL_ACCESS_TOKEN;
  else process.env.PANEL_ACCESS_TOKEN = token;
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-delete-route-"));
  directories.push(root);
  const project = path.join(root, "project"),
    state = path.join(root, "state");
  await mkdir(path.join(project, "src/config"), { recursive: true });
  await mkdir(path.join(project, "src/content/posts"), { recursive: true });
  await mkdir(path.join(project, "scripts"));
  await writeFile(
    path.join(project, "package.json"),
    JSON.stringify({ name: "mizuki", dependencies: { astro: "7" } }),
  );
  for (const file of ["src/content.config.ts", "src/config/index.ts", "scripts/sync-content.js"])
    await writeFile(path.join(project, file), "");
  await writeFile(path.join(project, ".env"), "ENABLE_CONTENT_SYNC=false\n");
  const filename = path.join(project, "src/content/posts/one.md"),
    source = "---\ntitle: 文章\npublished: 2026-10-12\n---\n\n正文\n";
  await writeFile(filename, source);
  await saveWorkspacePath(project, state);
  process.env.PANEL_ACCESS_TOKEN = "delete-fixture";
  const app = createApp({ expectedOrigin: origin, stateDir: state });
  const headers = {
    cookie: await loginCookie(app, "delete-fixture"),
    origin,
    "content-type": "application/json",
  };
  const workspace = await (await app.request(origin + "/api/workspace", { headers })).json();
  const snapshot = await (await app.request(origin + "/api/article?id=one.md", { headers })).json();
  const input = {
    id: "one.md",
    version: snapshot.article.version,
    projectKey: snapshot.projectKey,
  };
  const remove = (body: unknown = input, overrides: Record<string, string> = {}) =>
    app.request(origin + "/api/article", {
      method: "DELETE",
      headers: { ...headers, "x-mizuki-workspace": workspace.version, ...overrides },
      body: JSON.stringify(body),
    });
  return { app, headers, workspace, state, filename, source, input, remove };
}
it("defaults to recycling and records the original path for recovery", async () => {
  const { remove, state, filename, source } = await fixture();
  expect(await (await remove()).json()).toEqual({ ok: true, recycled: true });
  expect(existsSync(filename)).toBe(false);
  const trash = path.join(state, "trash/articles"),
    entries = await readdir(trash);
  const payload = entries.find((entry) => entry.endsWith("-one.md"))!;
  expect(await readFile(path.join(trash, payload), "utf8")).toBe(source);
  const metadata = await readFile(path.join(trash, payload + ".meta.json"), "utf8");
  expect(metadata).toContain("src/content/posts/one.md");
  expect(metadata).toContain('"article"');
});
it("permanently deletes only when recycling is explicitly false and leaves no recycle payload", async () => {
  const { remove, state, filename, input } = await fixture();
  const response = await remove({ ...input, recycle: false });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, recycled: false });
  expect(existsSync(filename)).toBe(false);
  expect(existsSync(path.join(state, "trash/articles"))).toBe(false);
  expect(existsSync(filename + ".mizuki-panel.lock")).toBe(false);
});
it("rejects wrong sessions, origins, project snapshots, paths, versions and invalid recycle flags", async () => {
  const { remove, input, filename, source } = await fixture();
  for (const [body, headers] of [
    [input, { cookie: "" }],
    [input, { origin: "http://wrong.invalid" }],
    [input, { "x-mizuki-workspace": "stale" }],
    [{ ...input, projectKey: "another" }, {}],
    [{ ...input, version: "stale", recycle: false }, {}],
    [{ ...input, id: "../../outside.md", recycle: false }, {}],
    [{ ...input, recycle: "false" }, {}],
  ] as Array<[unknown, Record<string, string>]>) {
    expect((await remove(body, headers)).status).toBeGreaterThanOrEqual(400);
    expect(await readFile(filename, "utf8")).toBe(source);
  }
  await writeFile(filename + ".mizuki-panel.lock", "busy");
  expect((await remove({ ...input, recycle: false })).status).toBe(409);
  expect(await readFile(filename, "utf8")).toBe(source);
});
it("preserves the file when a workspace becomes read-only after the deletion snapshot", async () => {
  const { app, headers, workspace, remove, input, filename, source } = await fixture();
  const settings = await (await app.request(origin + "/api/settings", { headers })).json();
  const response = await app.request(origin + "/api/settings", {
    method: "PATCH",
    headers: { ...headers, "x-mizuki-workspace": workspace.version },
    body: JSON.stringify({
      scope: "project",
      group: "access",
      fields: { readOnly: true },
      projectKey: settings.project.key,
      version: settings.project.settings.version,
    }),
  });
  expect(response.status).toBe(200);
  expect((await remove({ ...input, recycle: false })).status).toBeGreaterThanOrEqual(400);
  expect(await readFile(filename, "utf8")).toBe(source);
});
