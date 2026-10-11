import { createServer, request as httpRequest, type Server } from "node:http";
import { connect, type AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import {
  defaultBangumiNetworkSettings,
  bangumiSearchEndpoint,
  bangumiNetworkProblem,
} from "../src/shared/bangumi-settings";
import { searchBangumiAnime } from "../src/lib/server/bangumi-search";
import { bangumiDispatcher, closeBangumiAgents } from "../src/lib/server/bangumi-network";
import { windowsSystemProxy } from "../src/lib/server/system-proxy";
import { createApp } from "../src/server/app";
import { loginCookie } from "./auth-fixture";
import { emptyDocument, patchSettings } from "../src/shared/panel-settings";

vi.mock("../src/lib/server/system-proxy", () => ({ windowsSystemProxy: vi.fn() }));
const servers: Server[] = [];
const roots: string[] = [];
afterEach(async () => {
  await closeBangumiAgents();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
async function listen(server: Server) {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
async function fixture() {
  const received: { url: string; method: string; body: unknown }[] = [];
  const endpoint = await listen(
    createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        received.push({ url: req.url!, method: req.method!, body: JSON.parse(body) });
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            total: 1,
            limit: 20,
            offset: 0,
            data: [{ id: 123, type: 2, name: "Mock anime", name_cn: "动画", images: {} }],
          }),
        );
      });
    }),
  );
  let hops = 0;
  const proxyServer = createServer((req, res) => {
    hops++;
    const target = new URL(req.url!);
    const outgoing = httpRequest(
      target,
      { method: req.method, headers: req.headers },
      (response) => {
        res.writeHead(response.statusCode!, response.headers);
        response.pipe(res);
      },
    );
    outgoing.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(outgoing);
  });
  proxyServer.on("connect", (req, socket, head) => {
    hops++;
    const target = new URL(`http://${req.url}`);
    const upstream = connect(Number(target.port), target.hostname, () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("close", () => upstream.destroy());
  });
  const proxy = await listen(proxyServer);
  return { endpoint, proxy, received, hops: () => hops };
}
function clearProxyEnv() {
  for (const key of [
    "http_proxy",
    "HTTP_PROXY",
    "https_proxy",
    "HTTPS_PROXY",
    "all_proxy",
    "ALL_PROXY",
    "no_proxy",
    "NO_PROXY",
  ])
    vi.stubEnv(key, "");
}

it.each([
  ["https://api.bgm.tv", "https://api.bgm.tv/v0/search/subjects"],
  ["https://mirror.example/bgm/", "https://mirror.example/bgm/v0/search/subjects"],
  ["https://mirror.example/bgm/v0/", "https://mirror.example/bgm/v0/search/subjects"],
])("builds the endpoint from %s without duplicating the API version", (base, endpoint) => {
  expect(bangumiSearchEndpoint(base).href).toBe(endpoint);
});
it("rejects invalid BaseURLs, proxy schemes and missing manual proxy addresses", () => {
  for (const baseUrl of [
    "file:///etc/passwd",
    "https://user:pass@example.com",
    "https://example.com?q=1",
    "https://example.com/#fragment",
  ])
    expect(bangumiNetworkProblem({ ...defaultBangumiNetworkSettings, baseUrl })).not.toBeNull();
  for (const proxyUrl of [
    "socks5://127.0.0.1:7890",
    "http://127.0.0.1:7890/path",
    "http://example.com?token=1",
  ])
    expect(bangumiNetworkProblem({ ...defaultBangumiNetworkSettings, proxyUrl })).not.toBeNull();
  expect(
    bangumiNetworkProblem({
      ...defaultBangumiNetworkSettings,
      proxyEnabled: true,
      followSystemProxy: false,
    }),
  ).toContain("填写代理");
  expect(() =>
    patchSettings(
      emptyDocument("machine"),
      "machine",
      "bangumi",
      { proxyEnabled: true, followSystemProxy: false },
      "test",
    ),
  ).toThrow("填写代理");
});
it("routes through a configured HTTP proxy without changing the global dispatcher", async () => {
  const fixtureData = await fixture();
  const settings = {
    ...defaultBangumiNetworkSettings,
    baseUrl: fixtureData.endpoint + "/mirror/v0",
    proxyEnabled: true,
    followSystemProxy: false,
    proxyUrl: fixtureData.proxy,
  };
  expect((await searchBangumiAnime("动画", 0, undefined, settings)).data[0].id).toBe(123);
  expect(fixtureData.hops()).toBeGreaterThan(0);
  expect(fixtureData.received[0]).toMatchObject({
    url: "/mirror/v0/search/subjects?limit=20&offset=0",
    method: "POST",
    body: { keyword: "动画", filter: { type: [2] } },
  });
  expect(windowsSystemProxy).not.toHaveBeenCalled();
});
it("disabling proxy forces a direct connection even when the process has proxy variables", async () => {
  const fixtureData = await fixture();
  vi.stubEnv("HTTP_PROXY", "http://127.0.0.1:9");
  vi.stubEnv("HTTPS_PROXY", "http://127.0.0.1:9");
  const settings = {
    ...defaultBangumiNetworkSettings,
    baseUrl: fixtureData.endpoint,
    proxyUrl: fixtureData.proxy,
  };
  await searchBangumiAnime("动画", 0, undefined, settings);
  expect(fixtureData.hops()).toBe(0);
  expect(fixtureData.received).toHaveLength(1);
  expect(windowsSystemProxy).not.toHaveBeenCalled();
});
it("follows proxy environment variables and honors NO_PROXY bypass rules", async () => {
  clearProxyEnv();
  const fixtureData = await fixture();
  vi.stubEnv("HTTP_PROXY", fixtureData.proxy);
  const settings = {
    ...defaultBangumiNetworkSettings,
    baseUrl: fixtureData.endpoint,
    proxyEnabled: true,
  };
  await searchBangumiAnime("动画", 0, undefined, settings);
  const proxied = fixtureData.hops();
  expect(proxied).toBeGreaterThan(0);
  vi.stubEnv("NO_PROXY", "127.0.0.1");
  await searchBangumiAnime("动画", 0, undefined, settings);
  expect(fixtureData.hops()).toBe(proxied);
  expect(fixtureData.received).toHaveLength(2);
  expect(windowsSystemProxy).not.toHaveBeenCalled();
});
it.skipIf(process.platform !== "win32")(
  "uses Windows system proxy resolution when no environment proxy is configured",
  async () => {
    clearProxyEnv();
    const fixtureData = await fixture();
    vi.mocked(windowsSystemProxy).mockResolvedValue(fixtureData.proxy);
    await searchBangumiAnime("动画", 0, undefined, {
      ...defaultBangumiNetworkSettings,
      baseUrl: fixtureData.endpoint,
      proxyEnabled: true,
    });
    expect(fixtureData.hops()).toBeGreaterThan(0);
    expect(windowsSystemProxy).toHaveBeenCalledWith(expect.any(URL), expect.any(AbortSignal));
  },
);
it.skipIf(process.platform !== "win32")(
  "preserves a system DIRECT rule and reports system discovery failures",
  async () => {
    clearProxyEnv();
    const fixtureData = await fixture();
    vi.mocked(windowsSystemProxy).mockResolvedValueOnce(null);
    const settings = {
      ...defaultBangumiNetworkSettings,
      baseUrl: fixtureData.endpoint,
      proxyEnabled: true,
    };
    await searchBangumiAnime("动画", 0, undefined, settings);
    expect(fixtureData.hops()).toBe(0);
    vi.mocked(windowsSystemProxy).mockRejectedValueOnce(new Error("discovery failed"));
    await expect(
      bangumiDispatcher(settings, new URL(fixtureData.endpoint + "/other")),
    ).rejects.toThrow("无法读取系统代理");
  },
);
it("persists settings through the authenticated API and immediately uses the saved BaseURL and proxy", async () => {
  const fixtureData = await fixture();
  const state = await mkdtemp(path.join(tmpdir(), "mizuki-bgm-network-"));
  roots.push(state);
  const token = "bangumi-network-test";
  vi.stubEnv("PANEL_ACCESS_TOKEN", token);
  const origin = "http://127.0.0.1:4173";
  const app = createApp({ stateDir: state, expectedOrigin: origin });
  expect((await app.request(`${origin}/api/settings`)).status).toBe(401);
  const cookie = await loginCookie(app, token);
  const headers = {
    cookie,
    origin,
    "content-type": "application/json",
    "x-mizuki-workspace": (
      await (await app.request(`${origin}/api/workspace`, { headers: { cookie } })).json()
    ).version,
  };
  const initial = await (await app.request(`${origin}/api/settings`, { headers })).json();
  expect(initial.machine.document.values.bangumi).toEqual(defaultBangumiNetworkSettings);
  const payload = {
    scope: "machine",
    group: "bangumi",
    version: initial.machine.version,
    fields: {
      ...defaultBangumiNetworkSettings,
      baseUrl: fixtureData.endpoint + "/mirror",
      proxyEnabled: true,
      followSystemProxy: false,
      proxyUrl: fixtureData.proxy,
    },
  };
  const patch = (body: unknown) =>
    app.request(`${origin}/api/settings`, { method: "PATCH", headers, body: JSON.stringify(body) });
  const saved = await patch(payload);
  expect(saved.status).toBe(200);
  const settings = await saved.json();
  expect((await patch(payload)).status).toBe(409);
  expect(
    (
      await patch({
        ...payload,
        version: settings.version,
        fields: { baseUrl: "javascript:invalid" },
      })
    ).status,
  ).toBe(400);
  const result = await app.request(`${origin}/api/feature/anime-search?keyword=动画`, { headers });
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({ data: [{ id: 123 }] });
  expect(fixtureData.hops()).toBeGreaterThan(0);
  expect(fixtureData.received[0].url).toContain("/mirror/v0/search/subjects");
});
