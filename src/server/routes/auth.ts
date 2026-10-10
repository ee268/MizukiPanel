import type { Hono } from "hono";
import { deleteCookie, setCookie, getCookie } from "hono/cookie";
import { SESSION_COOKIE, validAccessToken } from "../../lib/server/auth";
import { ApiError } from "../errors";
import { SessionPolicyError } from "../../lib/server/panel-sessions";
import { panelSessions } from "../session-manager";
import { record } from "../../shared/panel-settings";

export function registerAuthRoutes(app: Hono) {
  app.post("/api/auth/login", async (context) => {
    const body: unknown = await context.req.json().catch(() => null);
    const token = record(body) && typeof body.token === "string" ? body.token.trim() : undefined;
    if (!validAccessToken(token)) {
      throw new ApiError(401, "访问令牌无效，请使用本次启动时终端显示的令牌");
    }
    const sessions = panelSessions(app);
    let session;
    try {
      session = await sessions.create();
    } catch (error) {
      if (error instanceof SessionPolicyError) return context.json({ message: error.message }, 503);
      throw error;
    }
    sessions.revoke(getCookie(context, SESSION_COOKIE));
    setCookie(context, SESSION_COOKIE, session.id, {
      path: "/",
      httpOnly: true,
      sameSite: "Strict",
      secure: false,
    });
    return context.json({ ok: true, session: session.status });
  });

  app.post("/api/auth/logout", (context) => {
    panelSessions(app).revoke(getCookie(context, SESSION_COOKIE));
    deleteCookie(context, SESSION_COOKIE, { path: "/" });
    return context.json({ ok: true });
  });

  app.get("/api/session", async (context) => {
    const checked = await panelSessions(app).verify(getCookie(context, SESSION_COOKIE));
    return "status" in checked
      ? context.json(checked.status)
      : context.json({ message: "登录已失效", reason: checked.reason }, 401);
  });
  app.post("/api/auth/activity", async (context) => {
    const checked = await panelSessions(app).activity(getCookie(context, SESSION_COOKIE));
    return "status" in checked
      ? context.json(checked.status)
      : context.json({ message: "登录已失效", reason: checked.reason }, 401);
  });
}
