import { expect, it } from "vitest";
import { contributionCalendar, contributionLevel } from "../src/client/dashboard-contributions";

it("aligns contribution days into Sunday-first weeks and labels months", () => {
  const calendar = contributionCalendar([
    { date: "2026-08-31", count: 1 },
    { date: "2026-09-01", count: 2 },
    { date: "2026-09-02", count: 0 },
    { date: "2026-09-03", count: 3 },
    { date: "2026-09-04", count: 0 },
    { date: "2026-09-05", count: 0 },
    { date: "2026-09-06", count: 4 },
  ]);
  expect(calendar.weeks).toHaveLength(2);
  expect(calendar.weeks[0].days.slice(0, 1)).toEqual([null]);
  expect(calendar.weeks[0].days[1]?.date).toBe("2026-08-31");
  expect(calendar.weeks[1].days[0]?.date).toBe("2026-09-06");
  expect(calendar.months).toEqual([{ label: "9月", column: 0 }]);
});

it("maps zero through four commits to fixed theme color levels", () => {
  expect(contributionLevel(0)).toBe(0);
  expect(contributionLevel(1)).toBe(1);
  expect(contributionLevel(2)).toBe(2);
  expect(contributionLevel(3)).toBe(3);
  expect(contributionLevel(4)).toBe(4);
  expect(contributionLevel(12)).toBe(4);
});
