import { mkdir, mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Hono } from "hono";
import { afterEach, expect, it, vi } from "vitest";
import { currentProject } from "../src/server/project";
import { registerArticleRoutes } from "../src/server/routes/articles";
import { ApiError } from "../src/server/errors";
import { articleProjectKey } from "../src/lib/server/article-template";
import { createArticle } from "../src/lib/server/articles";
import type { ProjectReport } from "../src/lib/server/project";
vi.mock("../src/server/project", () => ({ currentProject: vi.fn() }));
const dirs: string[] = [];
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-template-route-"));
  dirs.push(root);
  await mkdir(path.join(root, "src/content/posts"), { recursive: true });
  const report: ProjectReport = {
    root,
    requestedPath: root,
    contentRoot: null,
    mode: "local",
    readOnly: false,
    mappings: [],
    warnings: [],
  };
  vi.mocked(currentProject).mockResolvedValue(report);
  const app = new Hono();
  registerArticleRoutes(app, path.join(root, "state"));
  app.onError((error, c) =>
    c.json({ message: error.message }, error instanceof ApiError ? error.status : 500),
  );
  return { app, report };
}
const post = (body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
afterEach(async () => {
  vi.resetAllMocks();
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
it("binds creation to the current project and exact preview while preserving requested fields", async () => {
  const { app, report } = await fixture();
  const defaults = await (await app.request("http://localhost/api/articles/template")).json();
  const fields = {
    id: "new.md",
    title: "New",
    published: "2026-10-09",
    draft: true,
    body: "# New",
    frontmatter: "custom: [keep]",
    projectKey: defaults.projectKey,
    settingsVersion: defaults.settingsVersion,
  };
  const previewResponse = await app.request("http://localhost/api/articles/preview", post(fields));
  expect(previewResponse.status).toBe(200);
  const preview = await previewResponse.json();
  expect(preview.source).toMatch(/^---\ncustom:/);
  expect(
    (
      await app.request(
        "http://localhost/api/articles",
        post({ ...fields, previewVersion: "stale" }),
      )
    ).status,
  ).toBe(409);
  const created = await app.request(
    "http://localhost/api/articles",
    post({ ...fields, previewVersion: preview.previewVersion }),
  );
  expect(created.status).toBe(201);
  expect((await created.json()).article.source).toBe(preview.source);
  expect((await app.request("http://localhost/api/articles/preview", post(fields))).status).toBe(
    400,
  );
  expect(
    (
      await app.request(
        "http://localhost/api/articles/preview",
        post({ ...fields, id: "other.md", projectKey: "other" }),
      )
    ).status,
  ).toBe(409);
});
it("refuses article mutations targeted at a previous project even when the path and version match", async () => {
  const { app, report } = await fixture();
  await createArticle(
    report,
    "same.md",
    { title: "Same", published: "2026-10-09", draft: true },
    "body",
  );
  const old = await (await app.request("http://localhost/api/article?id=same.md")).json();
  const second = await fixture();
  await createArticle(
    second.report,
    "same.md",
    { title: "Same", published: "2026-10-09", draft: true },
    "body",
  );
  vi.mocked(currentProject).mockResolvedValue(second.report);
  const before = await readFile(path.join(second.report.root, "src/content/posts/same.md"), "utf8");
  const base = { id: "same.md", version: old.article.version, projectKey: old.projectKey };
  for (const [route, method, extra] of [
    ["/api/article/body", "PUT", { body: "wrong" }],
    ["/api/article/source", "PUT", { source: old.article.source }],
    ["/api/article/frontmatter", "PUT", { entries: old.article.frontmatter }],
    ["/api/article/rename", "POST", { nextId: "other.md" }],
    ["/api/article", "DELETE", {}],
  ] as const) {
    const response = await app.request("http://localhost" + route, {
      ...post({ ...base, ...extra }),
      method,
    });
    expect(response.status).toBe(409);
  }
  expect(await readFile(path.join(second.report.root, "src/content/posts/same.md"), "utf8")).toBe(
    before,
  );
  expect(await articleProjectKey(report)).not.toBe(await articleProjectKey(second.report));
});
