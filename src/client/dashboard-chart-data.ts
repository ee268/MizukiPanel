import type { DashboardDay } from "./types";

export type ArticleActivityRange = "30d" | "90d" | "12m";

export interface ArticleChartPoint {
  [key: string]: string | number;
  period: string;
  label: string;
  count: number;
}

function shortDate(value: string): string {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function monthKeys(endDate: string): string[] {
  const [year, month] = endDate.split("-").map(Number);
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 12 + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function articleChartData(
  activity: DashboardDay[],
  range: ArticleActivityRange,
): ArticleChartPoint[] {
  if (!activity.length) return [];
  if (range !== "12m") {
    const length = range === "30d" ? 30 : 90;
    return activity.slice(-length).map((day) => ({
      period: day.date,
      label: shortDate(day.date),
      count: day.count,
    }));
  }

  const months = monthKeys(activity.at(-1)!.date);
  const counts = new Map(months.map((month) => [month, 0]));
  for (const day of activity) {
    const month = day.date.slice(0, 7);
    if (counts.has(month)) counts.set(month, counts.get(month)! + day.count);
  }
  return months.map((month) => ({
    period: month,
    label: `${month.slice(2, 4)}/${month.slice(5, 7)}`,
    count: counts.get(month) ?? 0,
  }));
}

export function articleRangeTotal(points: ArticleChartPoint[]): number {
  return points.reduce((sum, point) => sum + point.count, 0);
}
