import type { Hono } from "hono";
import { dashboardOverview } from "../../lib/server/dashboard";
import { selectWorkspaceDirectory } from "../../lib/server/workspace";
import { workspaceSession, WorkspaceTaskError } from "../../lib/server/workspace-session";
import { record } from "../../shared/panel-settings";
import { ApiError, mapError } from "../errors";
import { currentProject } from "../project";

export function registerWorkspaceRoutes(app: Hono, stateDir?: string) {
  const session = workspaceSession(stateDir);
  app.get("/api/workspace", async (context) => {
    return context.json(await session.overview());
  });

  app.post("/api/workspace/select-directory", async (context) => {
    const body: { initialPath?: string } = await context.req
      .json<{ initialPath?: string }>()
      .catch(() => ({}));
    try {
      return context.json({ path: await selectWorkspaceDirectory(body.initialPath) });
    } catch (error) {
      mapError(error);
    }
  });
  app.post("/api/workspace/connect", async (context) => {
    const body: unknown = await context.req.json().catch(() => null);
    if (
      !record(body) ||
      typeof body.projectPath !== "string" ||
      !body.projectPath ||
      typeof body.version !== "string"
    )
      throw new ApiError(400, "请输入项目目录并读取最新工作区状态");
    try {
      return context.json(
        await session.connect(body.projectPath, body.version, body.stopOwnedPreview === true),
      );
    } catch (error) {
      if (error instanceof WorkspaceTaskError)
        return context.json({ message: error.message, task: error.task }, 409);
      mapError(error);
    }
  });

  app.post("/api/workspace/disconnect", async (context) => {
    const body: unknown = await context.req.json().catch(() => null);
    if (!record(body) || typeof body.version !== "string")
      throw new ApiError(400, "请读取最新工作区状态");
    try {
      return context.json(await session.disconnect(body.version, body.stopOwnedPreview === true));
    } catch (error) {
      if (error instanceof WorkspaceTaskError)
        return context.json({ message: error.message, task: error.task }, 409);
      mapError(error);
    }
  });

  app.post("/api/workspace/recent/remove", async (context) => {
    const body: unknown = await context.req.json().catch(() => null);
    if (
      !record(body) ||
      typeof body.id !== "string" ||
      !(body.version === null || typeof body.version === "string")
    )
      throw new ApiError(400, "项目记录参数无效");
    try {
      return context.json(await session.removeRecent(body.id, body.version));
    } catch (error) {
      mapError(error);
    }
  });
  for (const action of ["preview", "apply"] as const)
    app.post(`/api/workspace/reassociate/${action}`, async (context) => {
      const body: unknown = await context.req.json().catch(() => null);
      if (
        !record(body) ||
        typeof body.id !== "string" ||
        typeof body.projectPath !== "string" ||
        !(body.version === null || typeof body.version === "string")
      )
        throw new ApiError(400, "关联参数无效");
      try {
        if (action === "preview")
          return context.json(
            await session.reassociationPreview(body.id, body.projectPath, body.version),
          );
        if (typeof body.previewVersion !== "string") throw new ApiError(400, "请先预览关联结果");
        return context.json(
          await session.reassociate(body.id, body.projectPath, body.version, body.previewVersion),
        );
      } catch (error) {
        mapError(error);
      }
    });

  app.get("/api/dashboard", async (context) =>
    context.json(await dashboardOverview(await currentProject())),
  );
}
