export interface BangumiAnime {
  id: number;
  name: string;
  nameCn: string;
  date: string;
  image: string;
  score: number | null;
}

export interface BangumiSearchPage {
  total: number;
  limit: number;
  offset: number;
  data: BangumiAnime[];
}

export const bangumiSearchSorts = [
  { value: "date-desc", label: "时间降序" },
  { value: "date-asc", label: "时间升序" },
  { value: "score", label: "评分优先" },
  { value: "match", label: "相关度优先" },
] as const;
export type BangumiSearchSort = (typeof bangumiSearchSorts)[number]["value"];
export const bangumiSearchResultLimit = 1000;

function airDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date.getTime()
    : null;
}

export function sortBangumiAnime(items: BangumiAnime[], sort: BangumiSearchSort): BangumiAnime[] {
  if (sort === "match") return [...items];
  return [...items].sort((left, right) => {
    const a = sort === "score" ? left.score : airDate(left.date);
    const b = sort === "score" ? right.score : airDate(right.date);
    if (a === null) return b === null ? 0 : 1;
    if (b === null) return -1;
    return sort === "date-asc" ? a - b : b - a;
  });
}

export function bangumiSubjectMarker(id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("无效的 Bangumi 条目 ID");
  return `{% ${id} %}`;
}
