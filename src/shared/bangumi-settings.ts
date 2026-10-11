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
      (proxy
        ? url.pathname === "/" && Number(url.port || (url.protocol === "https:" ? 443 : 80)) >= 1
        : !url.username && !url.password)
    );
  } catch {
    return false;
  }
}
export const validBangumiBaseUrl = (value: unknown): boolean => httpUrl(value, false);
export const validBangumiProxyUrl = (value: unknown): boolean =>
  value === "" || httpUrl(value, true);

function proxyAddressUrl(address: string): URL | null {
  const text = address.trim();
  if (!text || text.length > 1900) return null;
  const absolute = text.includes("://") ? text : `http://${text}`;
  if (!httpUrl(absolute, true)) return null;
  const authority = absolute.split("://")[1].split("/")[0].split("@").at(-1)!;
  // URL removes explicit default ports (80/443), so also check the original host.
  if (/:\d*$/.test(authority)) return null;
  return new URL(absolute);
}

export function validBangumiProxyPort(port: string): boolean {
  return /^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535;
}

export const validBangumiProxyAddress = (address: string): boolean =>
  Boolean(proxyAddressUrl(address));

export function bangumiProxyInputProblem(address: string, port: string): string | null {
  if (!proxyAddressUrl(address)) return "请填写有效的 HTTP/HTTPS 代理地址，端口需在右侧单独填写。";
  if (!validBangumiProxyPort(port)) return "代理端口必须是 1–65535 的整数。";
  return null;
}

export function composeBangumiProxyUrl(address: string, port: string): string {
  const problem = bangumiProxyInputProblem(address, port);
  if (problem) throw new Error(problem);
  const url = proxyAddressUrl(address)!;
  url.port = String(Number(port));
  return url.href.replace(/\/$/, "");
}

export function splitBangumiProxyUrl(proxyUrl: string): { address: string; port: string } {
  if (!proxyUrl) return { address: "", port: "7890" };
  try {
    const url = new URL(proxyUrl);
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    url.port = "";
    return { address: url.href.replace(/\/$/, ""), port };
  } catch {
    return { address: proxyUrl, port: "7890" };
  }
}

export function bangumiNetworkProblem(settings: BangumiNetworkSettings): string | null {
  if (!validBangumiBaseUrl(settings.baseUrl))
    return "BaseURL 必须是 HTTP/HTTPS 地址，不能包含登录凭据、查询参数或片段。";
  if (!validBangumiProxyUrl(settings.proxyUrl))
    return "代理地址必须是 HTTP/HTTPS 地址，端口为 1–65535，例如 http://127.0.0.1:7890。";
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
