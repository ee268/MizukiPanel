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
  mode: 'local' | 'external' | 'blocked';
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
  published: string;
  draft: boolean;
  format: 'md' | 'mdx';
  error: string | null;
  alias: string;
  permalink: string;
  slug: string;
}

export interface FrontmatterEntry { key: string; value: string; originalKey?: string }

export interface ArticleRecord extends ArticleListItem {
  source: string;
  version: string;
  frontmatter: FrontmatterEntry[];
}

export interface MediaItem {
  scope: 'public' | 'article';
  path: string;
  size: number;
  modified: string;
  reference: string;
  referencedBy: string[];
}

export interface PreviewStatus {
  state: 'stopped' | 'starting' | 'running' | 'external' | 'failed';
  url: string;
  projectRoot: string | null;
  startedAt: string | null;
  logs: string[];
  error: string | null;
}
