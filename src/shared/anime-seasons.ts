import { stringify } from "yaml";

export const animeSeasonMonths = [1, 4, 7, 10] as const;

export function animeSeasonId(year: string, month: number) {
  if (!/^[1-9]\d{3}$/.test(year) || !animeSeasonMonths.some((item) => item === month))
    throw new Error("请选择有效的四位年份和季度（1月、4月、7月、10月）。");
  return `${year}/${month}月.md`;
}

export function animeSeasonTemplate(year: string, month: number, author: string) {
  animeSeasonId(year, month);
  return `---\n${stringify({
    cover: "http:://example.com",
    title: `${year}年${month}月新番`,
    date: `${year}/${String(month).padStart(2, "0")}/01`,
    author,
  })}---\n\n`;
}

export function groupAnimeSeasons<T extends { id: string }>(seasons: T[]) {
  const groups = new Map<string, T[]>();
  for (const season of seasons) {
    const year = season.id.split("/")[0];
    const items = groups.get(year) ?? [];
    items.push(season);
    groups.set(year, items);
  }
  return [...groups]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([year, items]) => ({
      year,
      items: items.sort(
        (a, b) => Number.parseInt(a.id.split("/")[1]) - Number.parseInt(b.id.split("/")[1]),
      ),
    }));
}
