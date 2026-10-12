import type { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { SESSION_COOKIE } from "../lib/server/auth";
import { type PanelSessions, SessionPolicyError } from "../lib/server/panel-sessions";
import { panelSessions } from "./session-manager";
import type { Context } from "hono";

export async function authorizeSession(app: Hono, context: Context) {
  try {
    const checked = await panelSessions(app).verify(getCookie(context, SESSION_COOKIE));
    if ("reason" in checked) {
      // A late response for an older ID must not clear a newly logged-in cookie.
      return context.json(
        {
          message:
            checked.reason === "idle"
              ? "会话因闲置超时，请重新登录。"
              : checked.reason === "maximum"
                ? "会话已达到最大有效期，请重新登录。"
                : "登录已失效",
          reason: checked.reason,
        },
        401,
      );
    }
    return null;
  } catch (error) {
    if (
      error instanceof SessionPolicyError ||
      ["EACCES", "EPERM", "EROFS"].includes((error as NodeJS.ErrnoException).code ?? "")
    )
      return context.json(
        {
          message:
            error instanceof SessionPolicyError
              ? error.message
              : "会话设置不可读取，请检查面板状态目录权限。",
        },
        503,
      );
    throw error;
  }
}

export function registerSecurityMiddleware(
  app: Hono,
  expectedOrigin: string,
  manager?: PanelSessions,
  queue?: <T>(work: () => Promise<T>) => Promise<T>,
) {
  panelSessions(app, manager);
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
    const proceed = async () => {
      if (context.req.path.startsWith("/api/") && context.req.path !== "/api/auth/login") {
        const rejected = await authorizeSession(app, context);
        if (rejected) return rejected;
      }
      await next();
    };
    // Queue writes before the asynchronous policy read so later requests cannot overtake them.
    return queue &&
      !["GET", "HEAD"].includes(context.req.method) &&
      context.req.path.startsWith("/api/") &&
      !context.req.path.startsWith("/api/auth/") &&
      context.req.path !== "/api/article/ai-writing" &&
      context.req.path !== "/api/workspace/select-directory"
      ? queue(proceed)
      : proceed();
  });
}
