import type { BangumiAnime, BangumiSearchPage } from "../../shared/bangumi-search";

const endpoint = "https://api.bgm.tv/v0/search/subjects";
const userAgent = "ee268/MizukiPanel/0.1.0 (https://github.com/ee268/MizukiPanel)";
const pageSize = 20;

export class BangumiSearchError extends Error {
  constructor(
    public status: 400 | 429 | 502 | 504,
    message: string,
  ) {
    super(message);
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function imageUrl(value: unknown): string {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export async function searchBangumiAnime(
  keyword: string,
  offset = 0,
  signal?: AbortSignal,
): Promise<BangumiSearchPage> {
  const query = keyword.trim();
  if (!query || query.length > 200)
    throw new BangumiSearchError(400, "请输入 1–200 个字符的动画名称");
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw new BangumiSearchError(400, "搜索分页参数无效");
  const url = new URL(endpoint);
  url.searchParams.set("limit", String(pageSize));
  url.searchParams.set("offset", String(offset));
  const timeout = AbortSignal.timeout(15_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": userAgent },
      body: JSON.stringify({ keyword: query, sort: "match", filter: { type: [2] } }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) {
      if (response.status === 429)
        throw new BangumiSearchError(429, "Bangumi 请求过于频繁，请稍后重试");
      throw new BangumiSearchError(502, "Bangumi 搜索暂时不可用，请稍后重试");
    }
    const result = record(await response.json());
    if (
      !Array.isArray(result.data) ||
      !Number.isSafeInteger(result.total) ||
      Number(result.total) < 0 ||
      !Number.isSafeInteger(result.limit) ||
      Number(result.limit) <= 0 ||
      Number(result.limit) > 20 ||
      result.offset !== offset ||
      result.data.length > Number(result.limit)
    )
      throw new BangumiSearchError(502, "Bangumi 返回的搜索结果格式异常，请重试");
    const data: BangumiAnime[] = result.data.flatMap((value) => {
      const item = record(value);
      if (!Number.isSafeInteger(item.id) || Number(item.id) <= 0 || item.type !== 2) return [];
      const images = record(item.images);
      const rating = record(item.rating);
      return [
        {
          id: Number(item.id),
          name: text(item.name),
          nameCn: text(item.name_cn),
          date: text(item.date),
          image: imageUrl(images.medium) || imageUrl(images.small),
          score:
            typeof rating.score === "number" && Number.isFinite(rating.score) ? rating.score : null,
        },
      ];
    });
    return { total: Number(result.total), limit: Number(result.limit), offset, data };
  } catch (error) {
    if (error instanceof BangumiSearchError) throw error;
    if (timeout.aborted) throw new BangumiSearchError(504, "Bangumi 搜索超时，请重试");
    throw new BangumiSearchError(502, "无法连接 Bangumi，请检查网络后重试");
  }
}
