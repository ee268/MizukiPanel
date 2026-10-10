import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Hono } from "hono";
import { afterEach, expect, it, vi } from "vitest";
import { registerConfigRoutes } from "../src/server/routes/configs";
import { currentProject } from "../src/server/project";
import { withWorkspaceState } from "../src/lib/server/workspace-state";
import { ApiError } from "../src/server/errors";

vi.mock("../src/server/project", () => ({ currentProject: vi.fn() }));
const roots: string[] = [];
afterEach(async () => {
  vi.resetAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it("supports backup, save and restoration of a previously absent override through the config API", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-config-backup-route-"));
  roots.push(root);
  const contentRoot = path.join(root, "content");
  await mkdir(path.join(root, "src/config"), { recursive: true });
  await mkdir(contentRoot);
  await writeFile(
    path.join(root, "src/config/siteConfig.ts"),
    'export const siteConfig = { title: "Default" };',
  );
  vi.mocked(currentProject).mockResolvedValue({
    root,
    requestedPath: root,
    mode: "external",
    readOnly: false,
    contentRoot,
    warnings: [],
    mappings: [],
  });
  const app = new Hono();
  app.use("/api/*", (_, next) => withWorkspaceState(path.join(root, "state"), next));
  registerConfigRoutes(app);
  app.onError((error, context) =>
    context.json({ message: error.message }, error instanceof ApiError ? error.status : 500),
  );
  const request = (endpoint: string, method: string, body: unknown) =>
    app.request(endpoint, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  expect((await request("/api/config/backup", "POST", { key: "siteConfig" })).status).toBe(400);
  expect((await app.request("/api/config/backups")).status).toBe(400);
  expect(await (await app.request("/api/config/backups?key=siteConfig")).json()).toEqual([]);
  const backingUp = await request("/api/config/backup", "POST", { key: "siteConfig", version: "" });
  expect(backingUp.status).toBe(200);
  const before = await backingUp.json();
  const response = await request("/api/config", "PUT", {
    key: "siteConfig",
    initializer: '{ title: "Override" }',
    version: "",
    backupId: before.backup.id,
  });
  expect(response.status).toBe(200);
  const saved = await response.json();
  expect(saved.backups).toHaveLength(1);
  const restoredResponse = await request("/api/config/restore", "POST", {
    key: "siteConfig",
    backupPath: before.backup.id,
    version: saved.config.version,
  });
  expect(restoredResponse.status).toBe(200);
  const restored = await restoredResponse.json();
  expect(restored.targetExists).toBe(false);
  expect(restored.version).toBe("");
  const history = await (await app.request("/api/config/backups?key=siteConfig")).json();
  expect(history).toHaveLength(2);
  const recovered = await request("/api/config/restore", "POST", {
    key: "siteConfig",
    backupPath: history[0].id,
    version: "",
  });
  expect(recovered.status).toBe(200);
  expect((await recovered.json()).effectiveValue).toMatchObject({ title: "Override" });
  expect(
    (await request("/api/config/backup", "POST", { key: "siteConfig", version: "stale" })).status,
  ).toBe(409);
});
