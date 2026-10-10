import { afterEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "../src/lib/server/auth";
import { createApp } from "../src/server/app";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const originalToken = process.env.PANEL_ACCESS_TOKEN;
const directories: string[] = [];

afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
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
    const stateDir = await mkdtemp(path.join(tmpdir(), "mizuki-app-state-"));
    directories.push(stateDir);
    const app = createApp({ expectedOrigin: origin, stateDir });

    const unauthorized = await app.request(`${origin}/api/session`);
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toMatchObject({ message: "登录已失效", reason: "invalid" });

    const login = await app.request(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie");
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).not.toContain(token);
    expect(cookie).toContain("HttpOnly");

    const session = await app.request(`${origin}/api/session`, {
      headers: { cookie: cookie! },
    });
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({ authenticated: true, expiresAt: null });

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
        "x-mizuki-workspace": (
          await (
            await app.request(`${origin}/api/workspace`, { headers: { cookie: cookie! } })
          ).json()
        ).version,
      },
      body: JSON.stringify({ id: "post.md", version: "v1", body: 12 }),
    });
    expect(invalidBody.status).toBe(400);
    expect(await invalidBody.json()).toEqual({ message: "正文保存参数不完整" });
  });
});
