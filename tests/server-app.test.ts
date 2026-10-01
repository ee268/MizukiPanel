import { afterEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "../src/lib/server/auth";
import { createApp } from "../src/server/app";

const originalToken = process.env.PANEL_ACCESS_TOKEN;

afterEach(() => {
  if (originalToken === undefined) {
    delete process.env.PANEL_ACCESS_TOKEN;
  } else {
    process.env.PANEL_ACCESS_TOKEN = originalToken;
  }
});

describe("server application", () => {
  it("composes authentication, security middleware, and API error handling", async () => {
    const token = "server-app-test-token";
    const origin = "http://127.0.0.1:4173";
    process.env.PANEL_ACCESS_TOKEN = token;
    const app = createApp({ expectedOrigin: origin });

    const unauthorized = await app.request(`${origin}/api/session`);
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({ message: "登录已失效" });

    const login = await app.request(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie");
    expect(cookie).toContain(`${SESSION_COOKIE}=${token}`);

    const session = await app.request(`${origin}/api/session`, {
      headers: { cookie: cookie! },
    });
    expect(session.status).toBe(200);
    expect(await session.json()).toEqual({ authenticated: true });

    const invalidOrigin = await app.request(`${origin}/api/auth/logout`, {
      method: "POST",
      headers: { cookie: cookie!, origin: "http://example.com" },
    });
    expect(invalidOrigin.status).toBe(403);
    expect(await invalidOrigin.json()).toEqual({ message: "请求来源无效" });

    const invalidArticle = await app.request(`${origin}/api/article`, {
      headers: { cookie: cookie! },
    });
    expect(invalidArticle.status).toBe(400);
    expect(await invalidArticle.json()).toEqual({ message: "缺少文章路径" });

    const invalidBody = await app.request(`${origin}/api/article/body`, {
      method: "PUT",
      headers: {
        cookie: cookie!,
        origin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ id: "post.md", version: "v1", body: 12 }),
    });
    expect(invalidBody.status).toBe(400);
    expect(await invalidBody.json()).toEqual({ message: "正文保存参数不完整" });
  });
});
