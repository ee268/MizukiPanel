export interface SourceMapping {
  key: string;
  label: string;
  sourcePath: string;
  resolvedPath?: string;
  exists: boolean;
  note?: string;
}

export interface ProjectReport {
  requestedPath: string;
  root: string;
  mode: "local" | "external" | "blocked";
  readOnly: boolean;
  contentRoot: string | null;
  warnings: string[];
  mappings: SourceMapping[];
}

export interface GitStatus {
  branch: string | null;
  changes: Array<{ status: string; path: string }>;
  ahead: number;
  behind: number;
}

export interface ArticleListItem {
  id: string;
  title: string;
  description: string;
  image: string;
  published: string;
  draft: boolean;
  format: "md" | "mdx";
  error: string | null;
  alias: string;
  permalink: string;
  slug: string;
  tags: string[];
  category: string;
}

export interface DashboardDay {
  date: string;
  count: number;
}

export interface DashboardOverview {
  generatedAt: string;
  range: { start: string; end: string };
  articles: {
    total: number;
    published: number;
    drafts: number;
    scheduled: number;
    invalid: number;
    addedLast30Days: number;
    activity: DashboardDay[];
    recent: Array<Pick<ArticleListItem, "id" | "title" | "published" | "draft" | "format">>;
    tags: Array<{ name: string; count: number }>;
  };
  git: {
    repositoryRoot: string;
    available: boolean;
    error: string | null;
    totalCommits: number;
    commitsLast30Days: number;
    currentStreak: number;
    longestStreak: number;
    activity: DashboardDay[];
  };
}

export interface FrontmatterEntry {
  key: string;
  value: string;
  originalKey?: string;
}

export interface ArticleRecord extends ArticleListItem {
  source: string;
  version: string;
  frontmatter: FrontmatterEntry[];
}

export interface MediaItem {
  scope: "public" | "article";
  path: string;
  size: number;
  modified: string;
  reference: string;
  referencedBy: string[];
}

export interface PreviewStatus {
  state: "stopped" | "starting" | "running" | "external" | "failed";
  url: string;
  projectRoot: string | null;
  startedAt: string | null;
  logs: string[];
  error: string | null;
}

export type ConfigValue =
  null | boolean | number | string | ConfigValue[] | { [key: string]: ConfigValue };

export interface ConfigDescriptor {
  key: string;
  label: string;
  group: string;
  file: string;
  exportName: string;
}

export interface SiteConfigDocument {
  report: ProjectReport;
  descriptor: ConfigDescriptor;
  mode: ProjectReport["mode"];
  readOnly: boolean;
  targetExists: boolean;
  version: string;
  initializer: string;
  defaultValue: ConfigValue;
  overrideValue: ConfigValue | null;
  effectiveValue: ConfigValue;
  changedPaths: string[];
  warnings: string[];
}

export interface FeatureModule {
  key: string;
  label: string;
  pagePath: string;
  switchKey: string | null;
  resources: string[];
  enabled: boolean;
  navigationConfigured: boolean;
  sourceMode?: string;
  sourceStatus?: string;
}

export interface FeatureDataDescriptor {
  key: string;
  module: string;
  label: string;
  file: string;
  variable: string;
  shape: "array" | "object";
}

export interface FeatureDataDocument {
  report: ProjectReport;
  descriptor: FeatureDataDescriptor;
  value: ConfigValue;
  version: string;
  sourcePath: string;
  readOnly: boolean;
  warnings: string[];
}

export interface FeatureTextDocument {
  report: ProjectReport;
  key: string;
  label: string;
  content: string;
  version: string;
  exists: boolean;
  readOnly: boolean;
}

export interface AnimeSeason {
  id: string;
  version: string;
  size: number;
}
export interface AnimeSeasonDocument {
  report: ProjectReport;
  id: string;
  content: string;
  version: string;
  readOnly: boolean;
}

export interface AlbumRecord {
  id: string;
  info: Record<string, unknown>;
  version: string;
  photos: string[];
  complete: boolean;
}
export interface PublishChange {
  status: string;
  path: string;
  originalPath: string | null;
  staged: boolean;
  conflict: boolean;
  managed: boolean;
}

export interface PublishCheck {
  key: string;
  label: string;
  status: "pass" | "warning" | "error";
  detail: string;
}

export interface PublishOverview {
  mode: ProjectReport["mode"];
  repositoryLabel: string;
  repositoryRoot: string;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  head: string | null;
  lastSubject: string | null;
  changes: PublishChange[];
  checks: PublishCheck[];
  canCommit: boolean;
  canPush: boolean;
  canSync: boolean;
  canBuild: boolean;
}

export interface PublishOperationStatus {
  kind: "validate" | "sync" | "build" | null;
  state: "idle" | "running" | "succeeded" | "failed";
  projectRoot: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  error: string | null;
}

export interface SiteIdentity {
  title: string;
  avatarUrl: string | null;
}
