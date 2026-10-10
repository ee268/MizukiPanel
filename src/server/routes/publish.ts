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
import {
  readLogRetention,
  taskPreferences,
  rememberPublishDefaults,
  logLimit,
} from "../../lib/server/task-preferences";

export function registerPublishRoutes(app: Hono, stateDir?: string) {
  app.get("/api/publish", async (context) => {
    try {
      const report = await currentProject();
      const preferences = await taskPreferences(report, stateDir);
      const machine = await readLogRetention(stateDir);
      return context.json({
        ...(await publishOverview(report)),
        preferences: preferences.publish,
        warnings: [...preferences.snapshot.warnings, ...machine.warnings],
      });
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
      const report = await currentProject();
      const preferences = await taskPreferences(report, stateDir);
      const result = await commitSelected(report, body.paths, body.message);
      const defaultsWarning = await rememberPublishDefaults(
        report,
        preferences,
        body.message,
        stateDir,
      );
      return context.json({ ...result, defaultsWarning });
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
  app.get("/api/publish/operation", async (context) => {
    await readLogRetention(stateDir);
    return context.json({
      ...publishOperationStatus(await currentProject()),
      logLimit: logLimit("publish", stateDir),
    });
  });
  app.post("/api/publish/operation", async (context) => {
    const body = await context.req.json<{ kind?: "validate" | "sync" | "build" }>();
    if (!body.kind || !["validate", "sync", "build"].includes(body.kind))
      throw new ApiError(400, "发布操作无效");
    try {
      return context.json(await startPublishOperation(await currentProject(), body.kind, stateDir));
    } catch (error) {
      mapError(error);
    }
  });
}
