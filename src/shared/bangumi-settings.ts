export interface BangumiNetworkSettings {
  baseUrl: string;
  followProjectBaseUrl: boolean;
  proxyEnabled: boolean;
  followSystemProxy: boolean;
  proxyUrl: string;
}

export const defaultBangumiNetworkSettings: BangumiNetworkSettings = {
  baseUrl: "https://api.bgm.tv",
  followProjectBaseUrl: true,
  proxyEnabled: false,
  followSystemProxy: true,
  proxyUrl: "",
};

export interface BangumiProjectBaseUrl {
  baseUrl: string;
  source: "project" | "fallback";
  warning?: string;
}

// The persisted enable flag gates the old system preference as well, so existing
// settings keep their routing behavior while the UI exposes mutually exclusive modes.
export type BangumiProxyMode = "off" | "custom" | "system";
export function bangumiProxyMode(settings: BangumiNetworkSettings): BangumiProxyMode {
  return !settings.proxyEnabled ? "off" : settings.followSystemProxy ? "system" : "custom";
}
export function bangumiProxyFields(mode: BangumiProxyMode) {
  return { proxyEnabled: mode !== "off", followSystemProxy: mode === "system" };
}

function httpUrl(value: unknown, proxy: boolean): boolean {
  if (typeof value !== "string" || !value.trim() || value.length > 2000) return false;
  try {
    const url = new URL(value.trim());
    return (
      ["http:", "https:"].includes(url.protocol) &&
      Boolean(url.hostname) &&
      !url.search &&
      !url.hash &&
      (proxy ? url.pathname === "/" : !url.username && !url.password)
    );
  } catch {
    return false;
  }
}
export const validBangumiBaseUrl = (value: unknown): boolean => httpUrl(value, false);
export const validBangumiProxyUrl = (value: unknown): boolean =>
  value === "" || httpUrl(value, true);

export function bangumiNetworkProblem(settings: BangumiNetworkSettings): string | null {
  if (!validBangumiBaseUrl(settings.baseUrl))
    return "BaseURL 必须是 HTTP/HTTPS 地址，不能包含登录凭据、查询参数或片段。";
  if (!validBangumiProxyUrl(settings.proxyUrl))
    return "代理地址必须是 HTTP/HTTPS 地址，例如 http://127.0.0.1:7890。";
  if (settings.proxyEnabled && !settings.followSystemProxy && !settings.proxyUrl.trim())
    return "请填写代理地址，或启用跟随系统代理。";
  return null;
}

export function bangumiSearchEndpoint(baseUrl: string): URL {
  if (!validBangumiBaseUrl(baseUrl)) throw new Error("Bangumi BaseURL 无效");
  const url = new URL(baseUrl.trim());
  let pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname.endsWith("/v0")) pathname += "/v0";
  url.pathname = pathname + "/search/subjects";
  return url;
}
