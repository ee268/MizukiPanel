import { expect, it } from "vitest";
import { articleChartData, articleRangeTotal } from "../src/client/dashboard-chart-data";
import type { DashboardDay } from "../src/client/types";

function activity(length: number): DashboardDay[] {
  const start = new Date(Date.UTC(2026, 0, 1));
  return Array.from({ length }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), count: index % 3 };
  });
}

it("selects the requested daily article activity window", () => {
  const days = activity(100);
  const thirty = articleChartData(days, "30d");
  const ninety = articleChartData(days, "90d");
  expect(thirty).toHaveLength(30);
  expect(thirty[0].period).toBe(days[70].date);
  expect(ninety).toHaveLength(90);
  expect(articleRangeTotal(thirty)).toBe(thirty.reduce((sum, point) => sum + point.count, 0));
});

it("aggregates the final twelve calendar months", () => {
  const days: DashboardDay[] = [
    { date: "2025-09-30", count: 9 },
    { date: "2025-10-01", count: 2 },
    { date: "2026-09-01", count: 1 },
    { date: "2026-09-27", count: 3 },
  ];
  const months = articleChartData(days, "12m");
  expect(months).toHaveLength(12);
  expect(months[0]).toEqual({ period: "2025-10", label: "25/10", count: 2 });
  expect(months.at(-1)).toEqual({ period: "2026-09", label: "26/09", count: 4 });
  expect(articleRangeTotal(months)).toBe(6);
});
