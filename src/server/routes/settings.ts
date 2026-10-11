import type { Hono } from "hono";
import path from "node:path";
import {
  readPanelSettings,
  savePanelSettings,
  savePanelSettingsGroups,
  settingsProjectKey,
} from "../../lib/server/panel-settings";
import { record, SettingsValidationError } from "../../shared/panel-settings";
import { currentProject } from "../project";
import { ApiError, errorMessage, mapError } from "../errors";
import { articleProjectKey } from "../../lib/server/article-template";
import { workspaceSession, readWorkspaceHistory } from "../../lib/server/workspace-session";
import { updateLogRetention } from "../../lib/server/task-preferences";
import { validatePreferenceGroups } from "../../shared/preferences-transfer";
import { readProjectBangumiBaseUrl } from "../../lib/server/bangumi-project";
import { assertProjectMediaDirectory } from "../../lib/server/project-media";

export function registerSettingsRoutes(app: Hono, stateDir?: string) {
  app.post("/api/settings/import", async (context) => {
    const body: unknown = await context.req.json().catch(() => null);
    if (
      !record(body) ||
      (body.scope !== "machine" && body.scope !== "project") ||
      !(body.version === null || typeof body.version === "string")
    )
      throw new ApiError(400, "偏好导入格式无效。");
    const groups = validatePreferenceGroups(body.scope, body.groups);
    const key =
      body.scope === "project"
        ? await settingsProjectKey((await currentProject(stateDir)).root)
        : undefined;
    if (body.scope === "project" && key !== body.projectKey)
      throw new ApiError(409, "当前项目已切换，请重新预览。");
    if (
      body.scope === "project" &&
      typeof groups.media?.storageFolder === "string" &&
      groups.media.storageFolder
    ) {
      try {
        await assertProjectMediaDirectory(
          await currentProject(stateDir),
          groups.media.storageFolder,
        );
      } catch (error) {
        mapError(error);
      }
    }
    const saved = await savePanelSettingsGroups(
      { scope: body.scope, groups, version: body.version as string | null, projectKey: key },
      stateDir,
    );
    if (body.scope === "machine") updateLogRetention(saved, stateDir);
    return context.json(saved);
  });
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
    if (await workspaceSession(stateDir).active()) {
      try {
        const report = await currentProject(stateDir);
        const key = await settingsProjectKey(report.root);
        project = {
          key,
          articleKey: await articleProjectKey(report),
          root: report.root,
          name: path.basename(report.root),
          settings: await readPanelSettings("project", key, stateDir),
          readOnlyInfo: {
            detected: report.detectedReadOnly ?? report.readOnly,
            preference: report.preferenceReadOnly ?? false,
            settings: report.settingsReadOnly ?? false,
          },
        };
      } catch (error) {
        warnings.push(`项目设置暂不可读取：${errorMessage(error)}`);
      }
    }
    return context.json({
      machine,
      project,
      warnings,
      bangumiDefault: await readProjectBangumiBaseUrl(project?.root),
    });
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
        const report = await currentProject(stateDir);
        projectKey = await settingsProjectKey(report.root);
        if (projectKey !== body.projectKey)
          throw new ApiError(409, "当前项目已切换，请重新读取项目设置。");
        if (
          body.group === "media" &&
          record(body.fields) &&
          typeof body.fields.storageFolder === "string" &&
          body.fields.storageFolder
        )
          await assertProjectMediaDirectory(report, body.fields.storageFolder);
      }
      if (
        body.scope === "machine" &&
        body.group === "workspace" &&
        record(body.fields) &&
        body.fields.defaultProject
      ) {
        await workspaceSession(stateDir).initialize();
        const history = await readWorkspaceHistory(stateDir);
        if (
          typeof body.fields.defaultProject !== "string" ||
          !Object.hasOwn(history.document.projects, body.fields.defaultProject)
        )
          throw new ApiError(400, "默认项目必须来自已连接过的项目记录。");
      }
      const saved = await savePanelSettings(
        {
          scope: body.scope as "machine" | "project",
          group: body.group,
          fields: body.fields,
          version: body.version as string | null,
          projectKey,
        },
        stateDir,
      );
      if (body.scope === "machine" && body.group === "logs") updateLogRetention(saved, stateDir);
      return context.json(saved);
    } catch (error) {
      if (error instanceof SettingsValidationError) throw new ApiError(400, error.message);
      if (["EACCES", "EPERM", "EROFS"].includes((error as NodeJS.ErrnoException).code ?? ""))
        throw new ApiError(403, "面板设置目录不可写，输入已保留，请检查目录权限后重试。");
      mapError(error);
    }
  });
}
