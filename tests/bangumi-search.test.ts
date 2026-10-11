import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { searchBangumiAnime } from "../src/lib/server/bangumi-search";
import { bangumiSubjectMarker } from "../src/shared/bangumi-search";
import { createApp } from "../src/server/app";
import { loginCookie } from "./auth-fixture";

const entry = {
  id: 496276,
  type: 2,
  name: "Original name",
  name_cn: "中文名",
  date: "2026-07-01",
  images: { medium: "https://lain.bgm.tv/pic/cover/m/example.jpg" },
  rating: { score: 8.1 },
};
const response = (data = [entry], offset = 0) =>
  new Response(JSON.stringify({ total: 31, limit: 10, offset, data }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it("searches only animation via POST with paging and a project User-Agent", async () => {
  const fetcher = vi.fn().mockResolvedValue(response([entry], 10));
  vi.stubGlobal("fetch", fetcher);
  const result = await searchBangumiAnime("  中文名  ", 10);
  const [url, options] = fetcher.mock.calls[0];
  expect(String(url)).toBe("https://api.bgm.tv/v0/search/subjects?limit=10&offset=10");
  expect(options.method).toBe("POST");
  expect(options.headers["User-Agent"]).toContain("ee268/MizukiPanel/0.1.0");
  expect(JSON.parse(options.body)).toEqual({
    keyword: "中文名",
    sort: "match",
    filter: { type: [2] },
  });
  expect(result).toEqual({
    total: 31,
    limit: 10,
    offset: 10,
    data: [
      {
        id: 496276,
        name: "Original name",
        nameCn: "中文名",
        date: "2026-07-01",
        image: entry.images.medium,
        score: 8.1,
      },
    ],
  });
});

it("rejects invalid searches before calling the upstream", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  for (const [keyword, offset] of [
    [" ", 0],
    ["x".repeat(201), 0],
    ["动画", -1],
    ["动画", 1.5],
    ["动画", Number.MAX_SAFE_INTEGER + 1],
  ] as const)
    await expect(searchBangumiAnime(keyword, offset)).rejects.toMatchObject({ status: 400 });
  expect(fetcher).not.toHaveBeenCalled();
});

it("drops invalid IDs and non-animation results, and handles missing optional metadata", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      response([
        { ...entry, id: -1 },
        { ...entry, type: 1 },
        { ...entry, id: "123" },
        { id: 123, type: 2, images: { medium: "javascript:alert(1)" } },
      ] as (typeof entry)[]),
    ),
  );
  expect((await searchBangumiAnime("动画")).data).toEqual([
    { id: 123, name: "", nameCn: "", date: "", image: "", score: null },
  ]);
});

it.each([429, 403, 500])(
  "reports upstream %s without returning its HTML response",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>upstream</html>", { status })),
    );
    await expect(searchBangumiAnime("动画")).rejects.toMatchObject({
      status: status === 429 ? 429 : 502,
    });
  },
);

it.each([
  "not JSON",
  JSON.stringify({ total: 0, limit: 0, offset: 0, data: [] }),
  JSON.stringify({ total: 10, limit: 10, offset: 10, data: [] }),
  JSON.stringify({ total: 10, limit: 10, offset: 0, data: null }),
])("rejects malformed upstream responses: %s", async (body) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
  await expect(searchBangumiAnime("动画")).rejects.toMatchObject({ status: 502 });
});

it("reports network errors and propagates request cancellation", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
  await expect(searchBangumiAnime("动画")).rejects.toMatchObject({
    status: 502,
    message: expect.stringContaining("检查网络"),
  });
  const controller = new AbortController();
  controller.abort();
  const fetcher = vi.fn().mockImplementation((_, options: RequestInit) => {
    expect(options.signal?.aborted).toBe(true);
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  });
  vi.stubGlobal("fetch", fetcher);
  await expect(searchBangumiAnime("动画", 0, controller.signal)).rejects.toMatchObject({
    status: 502,
  });
});

it("reports a bounded timeout", async () => {
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
    expect(milliseconds).toBe(15000);
    controller.abort(new DOMException("Timeout", "TimeoutError"));
    return controller.signal;
  });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(controller.signal.reason));
  try {
    await expect(searchBangumiAnime("动画")).rejects.toMatchObject({ status: 504 });
  } finally {
    timeout.mockRestore();
  }
});

it("formats valid IDs using the existing season renderer syntax", () => {
  expect(bangumiSubjectMarker(496276)).toBe("{% 496276 %}");
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    expect(() => bangumiSubjectMarker(id)).toThrow();
});

it("requires authentication and validates the search route without writing project files", async () => {
  const stateDir = await mkdtemp(path.join(tmpdir(), "mizuki-bangumi-search-"));
  const token = "bangumi-search-test-token";
  vi.stubEnv("PANEL_ACCESS_TOKEN", token);
  const fetcher = vi.fn().mockResolvedValue(response());
  vi.stubGlobal("fetch", fetcher);
  const origin = "http://127.0.0.1:4173";
  try {
    const app = createApp({ stateDir, expectedOrigin: origin });
    expect((await app.request(`${origin}/api/feature/anime-search?keyword=动画`)).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    const cookie = await loginCookie(app, token, origin);
    const get = (query: string) =>
      app.request(`${origin}/api/feature/anime-search?${query}`, { headers: { cookie } });
    for (const query of [
      "keyword=",
      "keyword=动画&offset=-1",
      "keyword=动画&offset=text",
      "keyword=动画&offset=1.5",
    ])
      expect((await get(query)).status).toBe(400);
    const result = await get("keyword=动画");
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ data: [{ id: 496276 }] });
    fetcher.mockResolvedValueOnce(new Response("rate limited", { status: 429 }));
    expect((await get("keyword=动画")).status).toBe(429);
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});
