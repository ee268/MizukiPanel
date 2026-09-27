import type { DashboardDay } from "./types";

export interface ContributionWeek {
  days: Array<DashboardDay | null>;
}

export interface ContributionMonth {
  label: string;
  column: number;
}

export interface ContributionCalendar {
  weeks: ContributionWeek[];
  months: ContributionMonth[];
}

function weekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function monthLabel(key: string): string {
  return `${Number(key.slice(5, 7))}月`;
}

export function contributionCalendar(activity: DashboardDay[]): ContributionCalendar {
  if (!activity.length) return { weeks: [], months: [] };

  const leading = weekday(activity[0].date);
  const cells: Array<DashboardDay | null> = [
    ...Array.from({ length: leading }, () => null),
    ...activity,
  ];
  while (cells.length % 7) cells.push(null);

  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => ({
    days: cells.slice(index * 7, index * 7 + 7),
  }));
  const months: ContributionMonth[] = [];
  const seen = new Set<string>();
  for (const [index, day] of activity.entries()) {
    const month = day.date.slice(0, 7);
    if (seen.has(month)) continue;
    seen.add(month);
    const marker = {
      label: monthLabel(month),
      column: Math.floor((leading + index) / 7),
    };
    if (months.at(-1)?.column === marker.column) months[months.length - 1] = marker;
    else months.push(marker);
  }
  return { weeks, months };
}

export function contributionLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  return Math.min(4, Math.floor(count)) as 1 | 2 | 3 | 4;
}
