import type { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { SESSION_COOKIE, validAccessToken } from "../lib/server/auth";

export function registerSecurityMiddleware(app: Hono, expectedOrigin: string) {
  app.use("*", async (context, next) => {
    const hostname = new URL(context.req.url).hostname;
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostname)) {
      return context.json({ message: "仅接受本机回环请求" }, 403);
    }
    if (!process.env.PANEL_ACCESS_TOKEN) {
      return context.json({ message: "请通过 pnpm dev 或 pnpm start 启动面板" }, 503);
    }
    if (!["GET", "HEAD"].includes(context.req.method) && context.req.path !== "/api/auth/login") {
      if (context.req.header("origin") !== expectedOrigin) {
        return context.json({ message: "请求来源无效" }, 403);
      }
    }
    if (context.req.path.startsWith("/api/") && context.req.path !== "/api/auth/login") {
      if (!validAccessToken(getCookie(context, SESSION_COOKIE))) {
        return context.json({ message: "登录已失效" }, 401);
      }
    }
    await next();
  });
}
