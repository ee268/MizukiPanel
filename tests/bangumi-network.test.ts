import { createServer, request as httpRequest, type Server } from "node:http";
import { connect, type AddressInfo } from "node:net";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import {
  defaultBangumiNetworkSettings,
  bangumiSearchEndpoint,
  bangumiNetworkProblem,
  bangumiProxyMode,
  bangumiProxyFields,
} from "../src/shared/bangumi-settings";
import { searchBangumiAnime } from "../src/lib/server/bangumi-search";
import {
  bangumiDispatcher,
  closeBangumiAgents,
  readBangumiNetworkSettings,
} from "../src/lib/server/bangumi-network";
import { windowsSystemProxy } from "../src/lib/server/system-proxy";
import { createApp } from "../src/server/app";
import { loginCookie } from "./auth-fixture";
import { emptyDocument, parseSettings, patchSettings } from "../src/shared/panel-settings";
import {
  readProjectBangumiBaseUrl,
  projectBangumiBaseUrl,
} from "../src/lib/server/bangumi-project";
import { workspaceSession } from "../src/lib/server/workspace-session";
import { savePanelSettings } from "../src/lib/server/panel-settings";
import type { ProjectReport } from "../src/lib/server/project";

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
  vi.restoreAllMocks();
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
  const project = path.join(state, "project");
  await mkdir(path.join(project, "public/js"), { recursive: true });
  await writeFile(
    path.join(project, "public/js/bgm-card.js"),
    `const BGM_BASE_URL = "${fixtureData.endpoint}/project/v0/subjects/";`,
  );
  const session = workspaceSession(state);
  vi.spyOn(session, "active").mockResolvedValue(project);
  vi.spyOn(session, "currentReport").mockResolvedValue({
    root: project,
    requestedPath: project,
    mode: "local",
    readOnly: false,
    contentRoot: null,
    mappings: [],
    warnings: [],
  });
  const overview = await (await app.request(`${origin}/api/settings`, { headers })).json();
  expect(overview.bangumiDefault).toEqual({
    baseUrl: fixtureData.endpoint + "/project",
    source: "project",
  });
  expect(
    (await app.request(`${origin}/api/feature/anime-search?keyword=动画`, { headers })).status,
  ).toBe(200);
  expect(fixtureData.received[0].url).toContain("/project/v0/search/subjects");
  const payload = {
    scope: "machine",
    group: "bangumi",
    version: initial.machine.version,
    fields: {
      ...defaultBangumiNetworkSettings,
      baseUrl: fixtureData.endpoint + "/mirror",
      followProjectBaseUrl: false,
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
  expect(fixtureData.received.at(-1)?.url).toContain("/mirror/v0/search/subjects");
});

it("extracts the quarterly renderer's literal BaseURL without evaluating scripts", () => {
  expect(
    projectBangumiBaseUrl(
      '(() => { const BGM_BASE_URL = "https://mirror.example/bgm/v0/subjects/"; })()',
    ),
  ).toBe("https://mirror.example/bgm");
  expect(projectBangumiBaseUrl("const BGM_BASE_URL = `https://mirror.example/v0`;")).toBe(
    "https://mirror.example/v0",
  );
  for (const source of [
    '// const BGM_BASE_URL = "https://fake.example";',
    "const BGM_BASE_URL = getUrl();",
    'const BGM_BASE_URL = "file:///outside";',
    'const BGM_BASE_URL = "https://user:pass@mirror.example";',
    'const BGM_BASE_URL = "https://mirror.example?q=1";',
    'const BGM_BASE_URL = "https://one.example"; function other() { const BGM_BASE_URL = "https://two.example"; }',
    'const BGM_BASE_URL = "https://mirror.example"; const broken = ;',
  ])
    expect(projectBangumiBaseUrl(source)).toBeNull();
});

it("migrates previous defaults to project following while retaining custom URLs and proxy behavior", () => {
  for (const baseUrl of ["https://api.bgm.tv", "https://custom.example"]) {
    const document = emptyDocument("machine");
    document.values.bangumi = {
      baseUrl,
      proxyEnabled: true,
      followSystemProxy: true,
      proxyUrl: "",
    };
    const parsed = parseSettings(JSON.stringify(document), "machine");
    expect(parsed.document.values.bangumi.followProjectBaseUrl).toBe(
      baseUrl === "https://api.bgm.tv",
    );
    expect(parsed.document.values.bangumi.baseUrl).toBe(baseUrl);
    expect(
      bangumiProxyMode(
        parsed.document.values.bangumi as unknown as typeof defaultBangumiNetworkSettings,
      ),
    ).toBe("system");
  }
  for (const mode of ["off", "custom", "system"] as const) {
    const settings = { ...defaultBangumiNetworkSettings, ...bangumiProxyFields(mode) };
    expect(bangumiProxyMode(settings)).toBe(mode);
    expect(
      [bangumiProxyMode(settings) === "custom", bangumiProxyMode(settings) === "system"].filter(
        Boolean,
      ).length,
    ).toBe(mode === "off" ? 0 : 1);
  }
});

it("follows current project and script changes, preserves an override, and restores project defaults", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-bgm-project-"));
  roots.push(root);
  const state = path.join(root, "state");
  await mkdir(state);
  const projects = [path.join(root, "first"), path.join(root, "second")];
  for (const [index, project] of projects.entries()) {
    await mkdir(path.join(project, "public/js"), { recursive: true });
    await writeFile(
      path.join(project, "public/js/bgm-card.js"),
      `const BGM_BASE_URL = "https://mirror${index}.example/v0/subjects/";`,
    );
  }
  let current = projects[0];
  const report = (): ProjectReport => ({
    root: current,
    requestedPath: current,
    mode: "local",
    readOnly: true,
    contentRoot: null,
    mappings: [],
    warnings: [],
  });
  const session = workspaceSession(state);
  vi.spyOn(session, "active").mockImplementation(async () => current);
  vi.spyOn(session, "currentReport").mockImplementation(async () => report());
  expect((await readBangumiNetworkSettings(state)).baseUrl).toBe("https://mirror0.example");
  current = projects[1];
  expect((await readBangumiNetworkSettings(state)).baseUrl).toBe("https://mirror1.example");
  const script = path.join(current, "public/js/bgm-card.js");
  await writeFile(script, 'const BGM_BASE_URL = "https://updated.example/v0/subjects/";');
  expect((await readBangumiNetworkSettings(state)).baseUrl).toBe("https://updated.example");
  expect(await readProjectBangumiBaseUrl(current)).toEqual({
    baseUrl: "https://updated.example",
    source: "project",
  });
  const custom = await savePanelSettings(
    {
      scope: "machine",
      group: "bangumi",
      version: null,
      fields: { followProjectBaseUrl: false, baseUrl: "https://custom.example" },
    },
    state,
  );
  expect((await readBangumiNetworkSettings(state)).baseUrl).toBe("https://custom.example");
  await savePanelSettings(
    {
      scope: "machine",
      group: "bangumi",
      version: custom.version,
      fields: defaultBangumiNetworkSettings,
    },
    state,
  );
  expect((await readBangumiNetworkSettings(state)).baseUrl).toBe("https://updated.example");
  expect(await readFile(script, "utf8")).toBe(
    'const BGM_BASE_URL = "https://updated.example/v0/subjects/";',
  );
  await rm(script);
  expect(await readProjectBangumiBaseUrl(current)).toMatchObject({
    baseUrl: "https://api.bgm.tv",
    source: "fallback",
    warning: expect.any(String),
  });
});
