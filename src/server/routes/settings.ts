import type { Hono } from "hono";
import path from "node:path";
import {
  readPanelSettings,
  savePanelSettings,
  settingsProjectKey,
} from "../../lib/server/panel-settings";
import { record, SettingsValidationError } from "../../shared/panel-settings";
import { readWorkspacePath } from "../../lib/server/workspace";
import { currentProject } from "../project";
import { ApiError, errorMessage, mapError } from "../errors";
import { articleProjectKey } from "../../lib/server/article-template";

export function registerSettingsRoutes(app: Hono, stateDir?: string) {
  app.get("/api/settings", async (context) => {
    let machine;
    try {
      machine = await readPanelSettings("machine", undefined, stateDir);
    } catch (error) {
      if (["EACCES", "EPERM", "EROFS"].includes((error as NodeJS.ErrnoException).code ?? ""))
        throw new ApiError(403, "本机设置不可读取，请检查面板状态目录权限。");
      throw error;
    }
    let project = null;
    const warnings: string[] = [];
    if (await readWorkspacePath(stateDir)) {
      try {
        const report = await currentProject();
        const key = await settingsProjectKey(report.root);
        project = {
          key,
          articleKey: await articleProjectKey(report),
          root: report.root,
          name: path.basename(report.root),
          settings: await readPanelSettings("project", key, stateDir),
        };
      } catch (error) {
        warnings.push(`项目设置暂不可读取：${errorMessage(error)}`);
      }
    }
    return context.json({ machine, project, warnings });
  });
  app.patch("/api/settings", async (context) => {
    const body: unknown = await context.req.json().catch(() => null);
    if (
      !record(body) ||
      (body.scope !== "machine" && body.scope !== "project") ||
      typeof body.group !== "string" ||
      !(body.version === null || typeof body.version === "string")
    )
      throw new ApiError(400, "设置请求格式无效。");
    try {
      let projectKey: string | undefined;
      if (body.scope === "project") {
        projectKey = await settingsProjectKey((await currentProject()).root);
        if (projectKey !== body.projectKey)
          throw new ApiError(409, "当前项目已切换，请重新读取项目设置。");
      }
      return context.json(
        await savePanelSettings(
          {
            scope: body.scope as "machine" | "project",
            group: body.group,
            fields: body.fields,
            version: body.version as string | null,
            projectKey,
          },
          stateDir,
        ),
      );
    } catch (error) {
      if (error instanceof SettingsValidationError) throw new ApiError(400, error.message);
      if (["EACCES", "EPERM", "EROFS"].includes((error as NodeJS.ErrnoException).code ?? ""))
        throw new ApiError(403, "面板设置目录不可写，输入已保留，请检查目录权限后重试。");
      mapError(error);
    }
  });
}
