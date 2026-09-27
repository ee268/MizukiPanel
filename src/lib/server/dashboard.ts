import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { listArticles, type ArticleListItem } from './articles';
import type { ProjectReport } from './project';

const run = promisify(execFile);

export interface DashboardDay {
  date: string;
  count: number;
}

export interface DashboardArticleSummary {
  total: number;
  published: number;
  drafts: number;
  scheduled: number;
  invalid: number;
  addedLast30Days: number;
  activity: DashboardDay[];
  recent: Array<Pick<ArticleListItem, 'id' | 'title' | 'published' | 'draft' | 'format'>>;
  tags: Array<{ name: string; count: number }>;
}

export interface DashboardGitSummary {
  repositoryRoot: string;
  available: boolean;
  error: string | null;
  totalCommits: number;
  commitsLast30Days: number;
  currentStreak: number;
  longestStreak: number;
  activity: DashboardDay[];
}

export interface DashboardOverview {
  generatedAt: string;
  range: { start: string; end: string };
  articles: DashboardArticleSummary;
  git: DashboardGitSummary;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function moveDate(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return dateKey(new Date(year, month - 1, day + days, 12));
}

function dateRange(start: string, end: string): DashboardDay[] {
  const days: DashboardDay[] = [];
  for (let current = start; current <= end; current = moveDate(current, 1)) {
    days.push({ date: current, count: 0 });
  }
  return days;
}

function publishedDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? dateKey(parsed) : null;
}

function countStreaks(activity: DashboardDay[]): { current: number; longest: number } {
  let running = 0;
  let longest = 0;
  for (const day of activity) {
    running = day.count > 0 ? running + 1 : 0;
    longest = Math.max(longest, running);
  }
  let current = 0;
  for (let index = activity.length - 1; index >= 0 && activity[index].count > 0; index--) current++;
  return { current, longest };
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', ['-C', root, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024
  });
  return stdout;
}

async function gitActivity(root: string, start: string, end: string): Promise<DashboardDay[]> {
  const topLevel = (await git(root, ['rev-parse', '--show-toplevel'])).trim();
  if (!samePath(topLevel, root)) throw new Error('Mizuki 项目目录不是 Git 仓库根目录');
  const output = await git(root, [
    'log',
    `--since=${start} 00:00:00`,
    `--until=${end} 23:59:59`,
    '--date=format-local:%Y-%m-%d',
    '--pretty=format:%ad'
  ]);
  const activity = dateRange(start, end);
  const byDate = new Map(activity.map((day) => [day.date, day]));
  for (const value of output.split(/\r?\n/)) {
    const day = byDate.get(value.trim());
    if (day) day.count++;
  }
  return activity;
}

function articleSummary(articles: ArticleListItem[], start: string, end: string): DashboardArticleSummary {
  const activity = dateRange(start, end);
  const byDate = new Map(activity.map((day) => [day.date, day]));
  const last30Start = moveDate(end, -29);
  const tagCounts = new Map<string, number>();
  let published = 0;
  let drafts = 0;
  let scheduled = 0;
  let invalid = 0;
  let addedLast30Days = 0;

  for (const article of articles) {
    if (article.error) {
      invalid++;
      continue;
    }
    if (article.draft) drafts++;
    const day = publishedDate(article.published);
    if (!day) {
      invalid++;
      continue;
    }
    if (!article.draft && day > end) {
      scheduled++;
    } else if (!article.draft) {
      published++;
      const point = byDate.get(day);
      if (point) point.count++;
      if (day >= last30Start) addedLast30Days++;
    }
    for (const tag of article.tags) {
      const name = tag.trim();
      if (name) tagCounts.set(name, (tagCounts.get(name) ?? 0) + 1);
    }
  }

  const recent = articles
    .filter((article) => !article.error && publishedDate(article.published))
    .sort((left, right) => right.published.localeCompare(left.published) || left.id.localeCompare(right.id))
    .slice(0, 8)
    .map(({ id, title, published: date, draft, format }) => ({ id, title, published: date, draft, format }));
  const tags = [...tagCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([name, count]) => ({ name, count }));

  return {
    total: articles.length,
    published,
    drafts,
    scheduled,
    invalid,
    addedLast30Days,
    activity,
    recent,
    tags
  };
}

export async function dashboardOverview(report: ProjectReport, now = new Date()): Promise<DashboardOverview> {
  const end = dateKey(now);
  const start = moveDate(end, -364);
  const articles = articleSummary(await listArticles(report), start, end);
  let gitSummary: DashboardGitSummary;
  try {
    const activity = await gitActivity(report.root, start, end);
    const streaks = countStreaks(activity);
    const last30Start = moveDate(end, -29);
    gitSummary = {
      repositoryRoot: report.root,
      available: true,
      error: null,
      totalCommits: activity.reduce((sum, day) => sum + day.count, 0),
      commitsLast30Days: activity
        .filter((day) => day.date >= last30Start)
        .reduce((sum, day) => sum + day.count, 0),
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      activity
    };
  } catch (error) {
    gitSummary = {
      repositoryRoot: report.root,
      available: false,
      error: error instanceof Error ? error.message : '无法读取 Mizuki 项目 Git 历史',
      totalCommits: 0,
      commitsLast30Days: 0,
      currentStreak: 0,
      longestStreak: 0,
      activity: dateRange(start, end)
    };
  }
  return { generatedAt: now.toISOString(), range: { start, end }, articles, git: gitSummary };
}
