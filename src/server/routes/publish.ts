import type { Hono } from "hono";
import {
  commitSelected,
  preparePublishLogs,
  publishCommitDetail,
  publishDiff,
  publishHistory,
  publishOperationStatus,
  publishOverview,
  startPublishOperation,
  pushCurrentBranch,
} from "../../lib/server/publish";
import { ApiError } from "../errors";
import { currentProject } from "../project";
import { taskPreferences, rememberPublishDefaults } from "../../lib/server/task-preferences";

export function registerPublishRoutes(app: Hono, stateDir?: string) {
  async function project() {
    const report = await currentProject();
    await preparePublishLogs(report, stateDir);
    return report;
  }
  app.get("/api/publish", async (context) => {
    const report = await project();
    const preferences = await taskPreferences(report, stateDir);
    return context.json({
      ...(await publishOverview(report)),
      preferences: preferences.publish,
      warnings: preferences.snapshot.warnings,
    });
  });
  app.get("/api/publish/history", async (context) =>
    context.json(
      await publishHistory(
        await project(),
        Number(context.req.query("page") ?? 1),
        context.req.query("head"),
        context.req.query("query") ?? "",
      ),
    ),
  );
  app.get("/api/publish/commit-detail", async (context) => {
    const sha = context.req.query("sha");
    if (!sha) throw new ApiError(400, "缺少提交标识");
    return context.json(await publishCommitDetail(await project(), sha));
  });
  app.get("/api/publish/diff", async (context) => {
    const filePath = context.req.query("path");
    if (!filePath) throw new ApiError(400, "缺少待预览的文件路径");
    return context.json({ diff: await publishDiff(await project(), filePath) });
  });
  app.post("/api/publish/commit", async (context) => {
    const body = await context.req.json<{ paths?: string[]; message?: string }>();
    if (
      !Array.isArray(body.paths) ||
      body.paths.some((p) => typeof p !== "string") ||
      typeof body.message !== "string"
    )
      throw new ApiError(400, "提交参数不完整");
    const report = await project();
    const preferences = await taskPreferences(report, stateDir);
    const result = await commitSelected(report, body.paths, body.message, stateDir);
    const defaultsWarning = await rememberPublishDefaults(
      report,
      preferences,
      body.message,
      stateDir,
    );
    return context.json({ ...result, defaultsWarning });
  });
  app.get("/api/publish/operation", async (context) =>
    context.json(publishOperationStatus(await project())),
  );
  app.post("/api/publish/push", async (context) => {
    const body = await context.req.json<{
      head?: string;
      branch?: string;
      upstream?: string;
      pushUrls?: string[];
    }>();
    if (
      typeof body.head !== "string" ||
      typeof body.branch !== "string" ||
      typeof body.upstream !== "string" ||
      !Array.isArray(body.pushUrls) ||
      body.pushUrls.some((url) => typeof url !== "string")
    )
      throw new ApiError(400, "请先确认当前分支及上游目标");
    return context.json(
      await pushCurrentBranch(await project(), stateDir, {
        head: body.head,
        branch: body.branch,
        upstream: body.upstream,
        pushUrls: body.pushUrls,
      }),
    );
  });
  app.post("/api/publish/operation", async (context) => {
    const body = await context.req.json<{ kind?: string }>();
    if (body.kind !== "build") throw new ApiError(400, "仅支持 Mizuki 构建操作");
    return context.json(await startPublishOperation(await project(), "build", stateDir));
  });
}
