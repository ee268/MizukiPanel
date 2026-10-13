import { readFile } from "node:fs/promises";
import path from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { ApiError, mapError } from "./errors";
import { registerSecurityMiddleware, authorizeSession } from "./middleware";
import { PanelSessions } from "../lib/server/panel-sessions";
import { registerArticleRoutes } from "./routes/articles";
import { registerAiWritingRoutes } from "./routes/ai-writing";
import { registerAiConversationRoutes } from "./routes/ai-conversations";
import { registerAiVaultRoutes } from "./routes/ai-vault";
import type { AiVault } from "../lib/server/ai-vault";
import { registerAuthRoutes } from "./routes/auth";
import { registerConfigRoutes } from "./routes/configs";
import { registerFeatureRoutes } from "./routes/features";
import { registerMediaRoutes } from "./routes/media";
import { registerMarkdownPreviewRoutes } from "./routes/markdown-preview";
import { registerPreviewRoutes } from "./routes/preview";
import { registerPublishRoutes } from "./routes/publish";
import { registerWorkspaceRoutes } from "./routes/workspace";
import { registerSettingsRoutes } from "./routes/settings";
import { registerPersonalSettingsRoutes } from "./routes/personal-settings";
import { registerMaintenanceRoutes } from "./routes/maintenance";
import { defaultStateDir } from "../lib/server/workspace";
import { workspaceSession, serializeWorkspaceMutation } from "../lib/server/workspace-session";
import { withWorkspaceState } from "./project";

export interface AppOptions {
  expectedOrigin?: string;
  clientRoot?: string;
  stateDir?: string;
  sessions?: PanelSessions;
  aiVault?: AiVault;
}

export function createApp(options: AppOptions = {}) {
  const app = new Hono();
  const expectedOrigin =
    options.expectedOrigin ??
    process.env.PANEL_ORIGIN ??
    `http://127.0.0.1:${process.env.PORT ?? 4173}`;
  const clientRoot = options.clientRoot ?? path.join(process.cwd(), "dist");

  const stateDir = options.stateDir ?? defaultStateDir();
  registerSecurityMiddleware(
    app,
    expectedOrigin,
    options.sessions ?? new PanelSessions(stateDir),
    serializeWorkspaceMutation,
  );
  app.use("/api/*", (context, next) =>
    withWorkspaceState(stateDir, async () => {
      const route = context.req.path;
      if (
        route.startsWith("/api/auth/") ||
        route === "/api/session" ||
        route === "/api/ai/credentials" ||
        route === "/api/ai/credentials/backup" ||
        route === "/api/settings/personal" ||
        route === "/api/settings/personal/initialize" ||
        route === "/api/settings/personal/recover"
      )
        return next();
      const work = async () => {
        if (!["GET", "HEAD"].includes(context.req.method)) {
          const rejected = await authorizeSession(app, context);
          if (rejected) return rejected;
        }
        const expected = context.req.header("x-mizuki-workspace");
        const session = workspaceSession(stateDir);
        await session.initialize();
        if (
          !expected &&
          !["GET", "HEAD"].includes(context.req.method) &&
          route !== "/api/workspace/select-directory"
        )
          throw new ApiError(409, "请先读取工作区状态，再提交操作。");
        if (expected && route !== "/api/workspace" && expected !== session.version)
          throw new ApiError(
            409,
            "工作区已切换，请确认当前输入后重新载入页面；未将修改写入其他项目。",
          );
        return next();
      };
      return work();
    }),
  );
  registerAuthRoutes(app);
  registerWorkspaceRoutes(app, stateDir);
  registerSettingsRoutes(app, stateDir);
  registerPersonalSettingsRoutes(app, stateDir, options.aiVault);
  registerMaintenanceRoutes(app, stateDir);
  registerArticleRoutes(app, stateDir);
  registerAiWritingRoutes(app, options.aiVault);
  registerAiConversationRoutes(app, stateDir, options.aiVault);
  registerAiVaultRoutes(app, options.aiVault);
  registerConfigRoutes(app);
  registerFeatureRoutes(app);
  registerMediaRoutes(app, stateDir);
  registerMarkdownPreviewRoutes(app);
  registerPreviewRoutes(app, stateDir);
  registerPublishRoutes(app, stateDir);

  app.onError((error, context) => {
    try {
      mapError(error);
    } catch (mapped) {
      error = mapped as Error;
    }
    const status = error instanceof ApiError ? error.status : 500;
    if (status === 500) {
      console.error(error);
    }
    return context.json({ message: status === 500 ? "服务器内部错误" : error.message }, status);
  });

  app.use("/assets/*", serveStatic({ root: "./dist" }));
  for (const fileName of [
    "favicon.ico",
    "favicon.svg",
    "mizuki-panel-logo.svg",
    "mizuki-panel-logo-dark.svg",
  ]) {
    app.get(`/${fileName}`, serveStatic({ path: path.join(clientRoot, fileName) }));
  }
  app.get("*", async (context) =>
    context.html(await readFile(path.join(clientRoot, "index.html"), "utf8")),
  );

  return app;
}
