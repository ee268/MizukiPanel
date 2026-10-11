import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Hono } from "hono";
import { afterEach, expect, it, vi } from "vitest";
import { registerFeatureRoutes } from "../src/server/routes/features";
import { currentProject } from "../src/server/project";
import { withWorkspaceState } from "../src/lib/server/workspace-state";
import { ApiError } from "../src/server/errors";

vi.mock("../src/server/project", () => ({ currentProject: vi.fn() }));
const roots: string[] = [];
afterEach(async () => {
  vi.resetAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it("validates feature switch requests and returns the saved version or a conflict", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-feature-route-"));
  roots.push(root);
  await mkdir(path.join(root, "src/config"), { recursive: true });
  await writeFile(
    path.join(root, "src/config/siteConfig.ts"),
    'export const siteConfig = { title: "Keep", featurePages: { friends: true } };',
  );
  await writeFile(
    path.join(root, "src/config/navBarConfig.ts"),
    "export const navBarConfig = { links: [] };",
  );
  const report = {
    root,
    requestedPath: root,
    mode: "local" as const,
    readOnly: false,
    contentRoot: null,
    warnings: [],
    mappings: [],
  };
  vi.mocked(currentProject).mockResolvedValue(report);
  const app = new Hono();
  app.use("/api/*", (_, next) => withWorkspaceState(path.join(root, "state"), next));
  registerFeatureRoutes(app);
  app.onError((error, context) =>
    context.json({ message: error.message }, error instanceof ApiError ? error.status : 500),
  );
  const request = (body: unknown) =>
    app.request("/api/feature/enabled", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const before = await (await app.request("/api/features")).json();
  for (const body of [
    { key: "friends", enabled: false },
    { key: "friends", enabled: "false", version: before.siteConfigVersion },
    { key: 1, enabled: false, version: before.siteConfigVersion },
  ])
    expect((await request(body)).status).toBe(400);
  const response = await request({
    key: "friends",
    enabled: false,
    version: before.siteConfigVersion,
  });
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toMatchObject({ key: "friends", enabled: false });
  expect(result.siteConfigVersion).not.toBe(before.siteConfigVersion);
  expect(
    (await request({ key: "friends", enabled: true, version: before.siteConfigVersion })).status,
  ).toBe(409);
  expect(
    (await request({ key: "about", enabled: false, version: result.siteConfigVersion })).status,
  ).toBe(400);
  vi.mocked(currentProject).mockResolvedValue({ ...report, readOnly: true });
  expect(
    (await request({ key: "friends", enabled: true, version: result.siteConfigVersion })).status,
  ).toBe(400);
});
