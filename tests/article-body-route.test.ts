import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Hono } from "hono";
import { afterEach, expect, it, vi } from "vitest";
import { readArticle } from "../src/lib/server/articles";
import type { ProjectReport } from "../src/lib/server/project";
import { ApiError } from "../src/server/errors";
import { currentProject } from "../src/server/project";
import { registerArticleRoutes } from "../src/server/routes/articles";

vi.mock("../src/server/project", () => ({ currentProject: vi.fn() }));

const temporaryPaths: string[] = [];
afterEach(async () => {
  vi.resetAllMocks();
  for (const target of temporaryPaths.splice(0)) {
    await rm(target, { recursive: true, force: true });
  }
});

it("saves a body through the HTTP route and maps conflicts to 409", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-body-route-"));
  temporaryPaths.push(root);
  const posts = path.join(root, "src/content/posts");
  await mkdir(posts, { recursive: true });
  await writeFile(
    path.join(posts, "post.md"),
    "---\ntitle: Route\npublished: 2026-09-27\n---\n\n# Before\n",
    "utf8",
  );
  const report: ProjectReport = {
    requestedPath: root,
    root,
    mode: "local",
    readOnly: false,
    contentRoot: null,
    warnings: [],
    mappings: [],
  };
  vi.mocked(currentProject).mockResolvedValue(report);

  const app = new Hono();
  registerArticleRoutes(app);
  app.onError((error, context) => {
    const status = error instanceof ApiError ? error.status : 500;
    return context.json({ message: error.message }, status);
  });

  const initial = await readArticle(report, "post.md");
  const request = {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "post.md", version: initial.version, body: "\n# After\n" }),
  };
  const saved = await app.request("http://localhost/api/article/body", request);
  expect(saved.status).toBe(200);
  const payload = await saved.json();
  expect(payload.article.source).toContain("# After");
  expect(payload.article.version).not.toBe(initial.version);
  expect(payload.previewPath).toBe("/posts/post/");

  const conflict = await app.request("http://localhost/api/article/body", request);
  expect(conflict.status).toBe(409);
});
