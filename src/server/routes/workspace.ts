import type { Hono } from "hono";
import { dashboardOverview } from "../../lib/server/dashboard";
import { inspectProject } from "../../lib/server/project";
import {
  clearWorkspace,
  readWorkspacePath,
  saveWorkspacePath,
  selectWorkspaceDirectory,
} from "../../lib/server/workspace";
import { ApiError, errorMessage, mapError } from "../errors";
import { currentProject } from "../project";
export function registerWorkspaceRoutes(app: Hono) {
  app.get("/api/workspace", async (context) => {
    const connectedPath = await readWorkspacePath();
    if (!connectedPath)
      return context.json({ connectedPath: null, report: null, connectionError: null });
    try {
      return context.json({
        connectedPath,
        report: await inspectProject(connectedPath),
        connectionError: null,
      });
    } catch (error) {
      return context.json({ connectedPath, report: null, connectionError: errorMessage(error) });
    }
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
    const { projectPath } = await context.req.json<{ projectPath?: string }>();
    if (!projectPath) throw new ApiError(400, "请输入 Mizuki 项目目录");
    try {
      const report = await inspectProject(projectPath);
      await saveWorkspacePath(report.root);
      return context.json({ report });
    } catch (error) {
      mapError(error);
    }
  });

  app.post("/api/workspace/disconnect", async (context) => {
    await clearWorkspace();
    return context.json({ ok: true });
  });

  app.get("/api/dashboard", async (context) =>
    context.json(await dashboardOverview(await currentProject())),
  );
}
