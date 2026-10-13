import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import { saveWorkspacePath } from "../src/lib/server/workspace";
import { loginCookie } from "./auth-fixture";
import { MaintenanceStore } from "../src/lib/server/maintenance";

const roots: string[] = [],
  token = process.env.PANEL_ACCESS_TOKEN;
const origin = "http://127.0.0.1:4173";
afterEach(async () => {
  if (token === undefined) delete process.env.PANEL_ACCESS_TOKEN;
  else process.env.PANEL_ACCESS_TOKEN = token;
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-autosave-route-"));
  roots.push(root);
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
  const source =
    "---\n# 保留注释\ntitle: 原标题\npublished: 2026-10-13\ndraft: true\ncustom: preserved\n---\n\n原始正文\n";
  const filename = path.join(project, "src/content/posts/one.md");
  await writeFile(filename, source);
  await saveWorkspacePath(project, state);
  process.env.PANEL_ACCESS_TOKEN = "autosave-fixture";
  const app = createApp({ expectedOrigin: origin, stateDir: state });
  const headers = {
    cookie: await loginCookie(app, "autosave-fixture"),
    origin,
    "content-type": "application/json",
  };
  const workspace = await (await app.request(origin + "/api/workspace", { headers })).json();
  const snapshot = await (await app.request(origin + "/api/article?id=one.md", { headers })).json();
  const entries = snapshot.article.frontmatter.map((row: { key: string; value: string }) => ({
    ...row,
    value: row.key === "title" ? "新标题" : row.value,
  }));
  const input = {
    id: "one.md",
    projectKey: snapshot.projectKey,
    version: snapshot.article.version,
    body: "新正文\n",
    entries,
  };
  const put = (body: unknown = input, extra: Record<string, string> = {}) =>
    app.request(origin + "/api/article/autosave", {
      method: "PUT",
      headers: { ...headers, "x-mizuki-workspace": workspace.version, ...extra },
      body: JSON.stringify(body),
    });
  return { app, headers, workspace, project, state, source, filename, input, put };
}
it.each(["body", "frontmatter", "both"])(
  "writes only the selected part in a single atomic save (%s)",
  async (scope) => {
    const { state, source, filename, input, put } = await fixture();
    const payload = {
      ...input,
      ...(scope === "body"
        ? { entries: undefined }
        : scope === "frontmatter"
          ? { body: undefined }
          : {}),
    };
    const response = await put(payload);
    expect(response.status).toBe(200);
    const { article } = await response.json();
    const content = await readFile(filename, "utf8");
    expect(content).toContain(scope === "body" ? "title: 原标题" : "title: 新标题");
    expect(content).toContain(scope === "frontmatter" ? "原始正文" : "新正文");
    expect(content).toContain("# 保留注释");
    expect(content).toContain("custom: preserved");
    expect(article.source).toBe(content);
    const files = await readdir(path.join(state, "backups/articles"));
    expect(files.filter((name) => name.endsWith(".bak"))).toHaveLength(1);
    expect(
      await readFile(
        path.join(
          state,
          "backups/articles",
          files.find((name) => name.endsWith(".bak"))!,
        ),
        "utf8",
      ),
    ).toBe(source);
    expect((await put({ ...payload, version: article.version })).status).toBe(200);
    expect(
      (await readdir(path.join(state, "backups/articles"))).filter((name) => name.endsWith(".bak")),
    ).toHaveLength(1);
  },
);
it("rejects an invalid field without committing body changes or creating backups", async () => {
  const { state, filename, source, input, put } = await fixture();
  const entries = input.entries.map((row: { key: string; value: string }) => ({
    ...row,
    value: row.key === "published" ? "not-a-date" : row.value,
  }));
  expect((await put({ ...input, entries })).status).toBe(400);
  expect(await readFile(filename, "utf8")).toBe(source);
  expect((await new MaintenanceStore(state).inventory(null)).items).toEqual([]);
});
it("checks auth, origin, workspace, project, version, path and payload before any write", async () => {
  const { filename, source, input, put } = await fixture();
  for (const [payload, extra] of [
    [input, { cookie: "" }],
    [input, { origin: "http://wrong.invalid" }],
    [input, { "x-mizuki-workspace": "old" }],
    [{ ...input, projectKey: "another" }, {}],
    [{ ...input, version: "old" }, {}],
    [{ ...input, id: "../../outside.md" }, {}],
    [{ ...input, entries: [null] }, {}],
    [{ ...input, entries: "yaml" }, {}],
    [{ ...input, body: 123 }, {}],
    [{ ...input, extra: true }, {}],
    [{ id: input.id, version: input.version, projectKey: input.projectKey }, {}],
  ] as Array<[unknown, Record<string, string>]>) {
    expect((await put(payload, extra)).status).toBeGreaterThanOrEqual(400);
    expect(await readFile(filename, "utf8")).toBe(source);
  }
});
it("preserves a disk edit and respects a workspace becoming read-only", async () => {
  const { app, headers, workspace, filename, source, input, put } = await fixture();
  await writeFile(filename, source + "external change");
  expect((await put()).status).toBe(409);
  expect(await readFile(filename, "utf8")).toContain("external change");
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
  expect((await put()).status).toBeGreaterThanOrEqual(400);
  expect(await readFile(filename, "utf8")).toContain("external change");
});
