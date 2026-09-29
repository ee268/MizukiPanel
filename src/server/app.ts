import { readFile } from "node:fs/promises";
import path from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { ApiError } from "./errors";
import { registerSecurityMiddleware } from "./middleware";
import { registerArticleRoutes } from "./routes/articles";
import { registerAuthRoutes } from "./routes/auth";
import { registerConfigRoutes } from "./routes/configs";
import { registerFeatureRoutes } from "./routes/features";
import { registerMediaRoutes } from "./routes/media";
import { registerPreviewRoutes } from "./routes/preview";
import { registerPublishRoutes } from "./routes/publish";
import { registerWorkspaceRoutes } from "./routes/workspace";

export interface AppOptions {
  expectedOrigin?: string;
  clientRoot?: string;
}

export function createApp(options: AppOptions = {}) {
  const app = new Hono();
  const expectedOrigin =
    options.expectedOrigin ??
    process.env.PANEL_ORIGIN ??
    `http://127.0.0.1:${process.env.PORT ?? 4173}`;
  const clientRoot = options.clientRoot ?? path.join(process.cwd(), "dist");

  registerSecurityMiddleware(app, expectedOrigin);
  registerAuthRoutes(app);
  registerWorkspaceRoutes(app);
  registerArticleRoutes(app);
  registerConfigRoutes(app);
  registerFeatureRoutes(app);
  registerMediaRoutes(app);
  registerPreviewRoutes(app);
  registerPublishRoutes(app);

  app.onError((error, context) => {
    const status = error instanceof ApiError ? error.status : 500;
    if (status === 500) {
      console.error(error);
    }
    return context.json({ message: status === 500 ? "服务器内部错误" : error.message }, status);
  });

  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.get("/favicon.ico", serveStatic({ path: "./dist/favicon.ico" }));
  app.get("*", async (context) =>
    context.html(await readFile(path.join(clientRoot, "index.html"), "utf8")),
  );

  return app;
}
