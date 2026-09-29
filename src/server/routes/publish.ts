import type { Hono } from "hono";
import {
  commitSelected,
  publishDiff,
  publishOperationStatus,
  publishOverview,
  pushCurrentBranch,
  revertPanelCommit,
  startPublishOperation,
} from "../../lib/server/publish";
import { ApiError, mapError } from "../errors";
import { currentProject } from "../project";
export function registerPublishRoutes(app: Hono) {
  app.get("/api/publish", async (context) => {
    try {
      return context.json(await publishOverview(await currentProject()));
    } catch (error) {
      mapError(error);
    }
  });
  app.get("/api/publish/diff", async (context) => {
    const filePath = context.req.query("path");
    if (!filePath) throw new ApiError(400, "缺少待预览的文件路径");
    try {
      return context.json({ diff: await publishDiff(await currentProject(), filePath) });
    } catch (error) {
      mapError(error);
    }
  });
  app.post("/api/publish/commit", async (context) => {
    const body = await context.req.json<{ paths?: string[]; message?: string }>();
    if (!Array.isArray(body.paths) || typeof body.message !== "string")
      throw new ApiError(400, "提交参数不完整");
    try {
      return context.json(await commitSelected(await currentProject(), body.paths, body.message));
    } catch (error) {
      mapError(error);
    }
  });
  app.post("/api/publish/push", async (context) => {
    try {
      return context.json(await pushCurrentBranch(await currentProject()));
    } catch (error) {
      mapError(error);
    }
  });
  app.post("/api/publish/revert", async (context) => {
    try {
      return context.json(await revertPanelCommit(await currentProject()));
    } catch (error) {
      mapError(error);
    }
  });
  app.get("/api/publish/operation", async (context) =>
    context.json(publishOperationStatus(await currentProject())),
  );
  app.post("/api/publish/operation", async (context) => {
    const body = await context.req.json<{ kind?: "validate" | "sync" | "build" }>();
    if (!body.kind || !["validate", "sync", "build"].includes(body.kind))
      throw new ApiError(400, "发布操作无效");
    try {
      return context.json(await startPublishOperation(await currentProject(), body.kind));
    } catch (error) {
      mapError(error);
    }
  });
}
