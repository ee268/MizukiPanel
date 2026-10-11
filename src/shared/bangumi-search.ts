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

export function bangumiSubjectMarker(id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("无效的 Bangumi 条目 ID");
  return `{% ${id} %}`;
}
