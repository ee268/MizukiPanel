import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { Hono } from "hono";
import { afterEach, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "../src/lib/server/auth";
import { ApiError } from "../src/server/errors";
import { registerMediaRoutes } from "../src/server/routes/media";
import { registerSecurityMiddleware } from "../src/server/middleware";
import { currentProject } from "../src/server/project";
import { settingsProjectKey, savePanelSettings } from "../src/lib/server/panel-settings";
import type { ProjectReport } from "../src/lib/server/project";
vi.mock("../src/server/project", () => ({ currentProject: vi.fn() }));
const directories: string[] = [];
const token = process.env.PANEL_ACCESS_TOKEN;
const origin = "http://127.0.0.1:4173";
afterEach(async () => {
  vi.resetAllMocks();
  if (token === undefined) delete process.env.PANEL_ACCESS_TOKEN;
  else process.env.PANEL_ACCESS_TOKEN = token;
  for (const root of directories.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-media-route-"));
  directories.push(root);
  await mkdir(path.join(root, "src/content/posts"), { recursive: true });
  await writeFile(
    path.join(root, "src/content/posts/one.md"),
    "---\ntitle: One\npublished: 2026-10-09\n---\n\n# One\n",
  );
  const stateDir = path.join(root, "state");
  const report: ProjectReport = {
    root,
    requestedPath: root,
    mode: "local",
    readOnly: false,
    contentRoot: null,
    mappings: [],
    warnings: [],
  };
  vi.mocked(currentProject).mockResolvedValue(report);
  const app = new Hono();
  process.env.PANEL_ACCESS_TOKEN = "media-route-test";
  registerSecurityMiddleware(app, origin);
  registerMediaRoutes(app, stateDir);
  app.onError((error, context) =>
    context.json({ message: error.message }, error instanceof ApiError ? error.status : 500),
  );
  const headers = { cookie: `${SESSION_COOKIE}=media-route-test`, origin };
  const bytes = await sharp({ create: { width: 120, height: 60, channels: 3, background: "red" } })
    .png()
    .toBuffer();
  const preferences = async () =>
    (await (await app.request(origin + "/api/media", { headers })).json()).preferences;
  const prepare = async (name = "photo.png", content = bytes) => {
    const pref = await preferences();
    const form = new FormData();
    form.set("file", new File([Uint8Array.from(content)], name));
    form.set("scope", "public");
    form.set("folder", "docs");
    form.set("projectKey", pref.projectKey);
    form.set("settingsVersion", pref.settingsVersion ?? "");
    return app.request(origin + "/api/media/prepare", { method: "POST", headers, body: form });
  };
  const commit = (body: unknown) =>
    app.request(origin + "/api/media/commit", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return { root, stateDir, report, app, headers, bytes, preferences, prepare, commit };
}
it("previews and uploads the exact selected output through authenticated multipart and JSON routes", async () => {
  const { root, stateDir, app, headers, bytes, prepare, commit } = await fixture();
  await savePanelSettings(
    {
      scope: "project",
      projectKey: await settingsProjectKey(root),
      group: "media",
      fields: { resize: true, maxDimension: 64, format: "webp", compress: true },
      version: null,
    },
    stateDir,
  );
  const response = await prepare();
  expect(response.status).toBe(200);
  const preview = await response.json();
  expect(preview.originalSize).toBe(bytes.length);
  expect(preview.processedPath).toBe("docs/photo.webp");
  expect(await readdir(root)).toEqual(["src", "state"]);
  const picture = await app.request(
    origin + `/api/media/prepared?token=${preview.token}&variant=processed`,
    { headers },
  );
  expect(picture.status).toBe(200);
  expect(picture.headers.get("content-type")).toBe("image/webp");
  expect((await sharp(Buffer.from(await picture.arrayBuffer())).metadata()).width).toBe(64);
  const saved = await commit({ token: preview.token, variant: "processed" });
  expect(saved.status).toBe(201);
  expect((await saved.json()).reference).toBe("/images/docs/photo.webp");
  expect(
    (await sharp(await readFile(path.join(root, "public/images/docs/photo.webp"))).metadata())
      .height,
  ).toBe(32);
  expect((await commit({ token: preview.token, variant: "processed" })).status).toBe(409);
});
it("protects resource limits, authentication, project binding, read-only state and malformed requests", async () => {
  const { root, app, headers, report, prepare, commit } = await fixture();
  expect((await app.request(origin + "/api/media")).status).toBe(401);
  expect(
    (
      await app.request(origin + "/api/media/prepare", {
        method: "POST",
        headers: { ...headers, "content-length": String(22 * 1024 * 1024) },
        body: "x",
      })
    ).status,
  ).toBe(413);
  const preview = await (await prepare()).json();
  vi.mocked(currentProject).mockResolvedValue({ ...report, readOnly: true });
  expect((await commit({ token: preview.token, variant: "original" })).status).toBe(400);
  expect((await prepare()).status).toBe(400);
  const other = await mkdtemp(path.join(tmpdir(), "mizuki-media-other-"));
  directories.push(other);
  vi.mocked(currentProject).mockResolvedValue({ ...report, root: other });
  expect((await commit({ token: preview.token, variant: "original" })).status).toBe(409);
  vi.mocked(currentProject).mockResolvedValue(report);
  expect((await commit({ token: preview.token, variant: "wrong" })).status).toBe(400);
  expect(
    (await app.request(origin + "/api/media/commit", { method: "POST", headers, body: "bad json" }))
      .status,
  ).toBe(400);
  expect(await readdir(root)).toEqual(["src"]);
});
it("preserves SVG originals, skips conversion, and serves SVG previews with a sandbox policy", async () => {
  const { root, stateDir, app, headers, prepare, commit } = await fixture();
  await savePanelSettings(
    {
      scope: "project",
      projectKey: await settingsProjectKey(root),
      group: "media",
      fields: { format: "webp", compress: true },
      version: null,
    },
    stateDir,
  );
  const source = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="red"/></svg>',
  );
  const preview = await (await prepare("vector.svg", source)).json();
  expect(preview.status).toBe("skipped");
  expect((await commit({ token: preview.token, variant: "original" })).status).toBe(201);
  const response = await app.request(
    origin + "/api/media/file?scope=public&path=docs%2Fvector.svg",
    { headers },
  );
  expect(response.headers.get("content-type")).toBe("image/svg+xml");
  expect(response.headers.get("content-security-policy")).toContain("sandbox");
  expect(Buffer.from(await response.arrayBuffer())).toEqual(source);
});
