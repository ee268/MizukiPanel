import type { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { SESSION_COOKIE, validAccessToken } from "../../lib/server/auth";
import { ApiError } from "../errors";

export function registerAuthRoutes(app: Hono) {
  app.post("/api/auth/login", async (context) => {
    const body: { token?: string } = await context.req.json<{ token?: string }>().catch(() => ({}));
    const token = body.token?.trim();
    if (!validAccessToken(token)) {
      throw new ApiError(401, "访问令牌无效，请使用本次启动时终端显示的令牌");
    }
    setCookie(context, SESSION_COOKIE, token!, {
      path: "/",
      httpOnly: true,
      sameSite: "Strict",
      secure: false,
    });
    return context.json({ ok: true });
  });

  app.post("/api/auth/logout", (context) => {
    deleteCookie(context, SESSION_COOKIE, { path: "/" });
    return context.json({ ok: true });
  });

  app.get("/api/session", (context) => context.json({ authenticated: true }));
}
