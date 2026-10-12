import type { Hono } from "hono";
import { MaintenanceStore } from "../../lib/server/maintenance";
import { currentProject } from "../project";
import { workspaceSession } from "../../lib/server/workspace-session";
import { record } from "../../shared/panel-settings";
import { ApiError } from "../errors";
import { ProjectError } from "../../lib/server/project";

export function registerMaintenanceRoutes(app: Hono, stateDir: string) {
  const store = new MaintenanceStore(stateDir);
  const project = async () => {
    try {
      return (await workspaceSession(stateDir).active()) ? await currentProject(stateDir) : null;
    } catch (error) {
      if (error instanceof ProjectError) return null;
      throw error;
    }
  };
  app.get("/api/maintenance", async (c) => c.json(await store.inventory(await project())));
  app.post("/api/maintenance/restore-preview", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (!record(body) || typeof body.id !== "string") throw new ApiError(400, "请选择恢复项。");
    return c.json(await store.restorePreview(body.id, await project()));
  });
  app.post("/api/maintenance/restore", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (!record(body) || typeof body.token !== "string") throw new ApiError(400, "恢复预览无效。");
    return c.json(await store.restore(body.token, await project()));
  });
  app.post("/api/maintenance/cleanup-preview", async (c) => {
    const raw = await c.req.text();
    let body: unknown = {};
    if (raw.trim()) {
      try {
        body = JSON.parse(raw);
      } catch {
        throw new ApiError(400, "清理类型无效。");
      }
    }
    if (
      !record(body) ||
      (body.kind !== undefined && body.kind !== "backup" && body.kind !== "trash")
    )
      throw new ApiError(400, "清理类型无效。");
    return c.json(
      await store.cleanupPreview(await project(), body.kind as "backup" | "trash" | undefined),
    );
  });
  app.post("/api/maintenance/cleanup", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    if (
      !record(body) ||
      typeof body.token !== "string" ||
      !Array.isArray(body.ids) ||
      !body.ids.every((id) => typeof id === "string")
    )
      throw new ApiError(400, "清理请求无效。");
    return c.json(await store.cleanup(body.token, body.ids, await project()));
  });
}
