import { Agent, EnvHttpProxyAgent, ProxyAgent, type Dispatcher } from "undici";
import {
  bangumiNetworkProblem,
  validBangumiProxyUrl,
  type BangumiNetworkSettings,
} from "../../shared/bangumi-settings";
import { readPanelSettings } from "./panel-settings";
import { windowsSystemProxy } from "./system-proxy";

export class BangumiNetworkError extends Error {}
let direct = new Agent();
const agents = new Map<string, Dispatcher>();
const systemCache = new Map<string, { until: number; proxy: string | null }>();
function cachedAgent(key: string, create: () => Dispatcher): Dispatcher {
  const known = agents.get(key);
  if (known) return known;
  const agent = create();
  agents.set(key, agent);
  if (agents.size > 8) {
    const oldest = agents.entries().next().value!;
    agents.delete(oldest[0]);
    void oldest[1].close().catch(() => {});
  }
  return agent;
}

export async function readBangumiNetworkSettings(
  stateDir?: string,
): Promise<BangumiNetworkSettings> {
  const snapshot = await readPanelSettings("machine", undefined, stateDir);
  if (snapshot.readOnly)
    throw new BangumiNetworkError("搜索设置不可读取，请先修复面板的本机设置。");
  return snapshot.document.values.bangumi as unknown as BangumiNetworkSettings;
}

export async function bangumiDispatcher(
  settings: BangumiNetworkSettings,
  target: URL,
  signal?: AbortSignal,
): Promise<Dispatcher> {
  const problem = bangumiNetworkProblem(settings);
  if (problem) throw new BangumiNetworkError(problem);
  // An explicit Agent also bypasses any proxy installed as Node's global dispatcher.
  if (!settings.proxyEnabled) return direct;
  if (!settings.followSystemProxy)
    return cachedAgent(
      `manual:${settings.proxyUrl.trim()}`,
      () => new ProxyAgent(settings.proxyUrl.trim()),
    );
  const httpProxy =
    process.env.http_proxy ||
    process.env.HTTP_PROXY ||
    process.env.all_proxy ||
    process.env.ALL_PROXY ||
    "";
  const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY || httpProxy;
  const noProxy = process.env.no_proxy ?? process.env.NO_PROXY ?? "";
  if (httpProxy || httpsProxy) {
    for (const proxy of [httpProxy, httpsProxy])
      if (!validBangumiProxyUrl(proxy))
        throw new BangumiNetworkError("系统代理环境变量必须使用 HTTP/HTTPS 代理地址。");
    return cachedAgent(
      JSON.stringify({ httpProxy, httpsProxy, noProxy }),
      () => new EnvHttpProxyAgent({ httpProxy, httpsProxy, noProxy }),
    );
  }
  if (process.platform !== "win32") return direct;
  const key = `${target.origin}${target.pathname}`;
  let system = systemCache.get(key);
  if (!system || system.until < Date.now()) {
    let proxy: string | null;
    try {
      proxy = await windowsSystemProxy(target, signal);
    } catch {
      throw new BangumiNetworkError("无法读取系统代理，请检查系统设置，或关闭跟随并填写代理地址。");
    }
    if (proxy && !validBangumiProxyUrl(proxy))
      throw new BangumiNetworkError("系统返回的代理地址不受支持，请使用 HTTP/HTTPS 代理。");
    system = { until: Date.now() + 5000, proxy };
    systemCache.set(key, system);
    if (systemCache.size > 8) systemCache.delete(systemCache.keys().next().value!);
  }
  return system.proxy
    ? cachedAgent(`system:${system.proxy}`, () => new ProxyAgent(system.proxy!))
    : direct;
}

export async function closeBangumiAgents(): Promise<void> {
  await Promise.all([direct, ...agents.values()].map((agent) => agent.close()));
  direct = new Agent();
  agents.clear();
  systemCache.clear();
}
