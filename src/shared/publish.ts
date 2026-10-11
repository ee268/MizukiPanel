export interface PublishChange {
  status: string;
  path: string;
  originalPath: string | null;
  staged: boolean;
  conflict: boolean;
}

export interface PublishRemote {
  name: string;
  fetchUrls: string[];
  pushUrls: string[];
}

export interface PublishOverview {
  preferences?: import("./task-settings").PublishSettings;
  warnings?: string[];
  repositoryRoot: string;
  repositoryAvailable: boolean;
  repositoryError: string | null;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  head: string | null;
  changes: PublishChange[];
  remotes: PublishRemote[];
  canCommit: boolean;
  commitDisabledReason: string | null;
  canPush: boolean;
  pushDisabledReason: string | null;
  pushRemote: string | null;
  canBuild: boolean;
  buildDisabledReason: string | null;
}

export interface PublishCommit {
  sha: string;
  author: string;
  email: string;
  date: string;
  subject: string;
  parents: string[];
  refs: string;
}

export interface PublishHistory {
  commits: PublishCommit[];
  total: number;
  page: number;
  pageSize: number;
  head: string | null;
  query: string;
}

export interface PublishCommitDetail {
  sha: string;
  message: string;
  diff: string;
  truncated: boolean;
}

export interface PublishOperationStatus {
  kind: "commit" | "push" | "build" | null;
  state: "idle" | "running" | "succeeded" | "failed";
  projectRoot: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  error: string | null;
  logLimit?: number;
}
