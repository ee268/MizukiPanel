export interface RecentProject {
  id: string;
  path: string;
  name: string;
  lastUsed: string;
  available?: boolean;
  error?: string;
}

export interface WorkspaceHistory {
  schemaVersion: 1;
  revision: string;
  projects: Record<string, RecentProject>;
  recent: string[];
  lastProject: string | null;
}

export interface WorkspaceMetadata {
  version: string;
  historyVersion: string | null;
  historyReadOnly: boolean;
  recentProjects: RecentProject[];
  defaultProject: RecentProject | null;
  warnings: string[];
  startupError: string | null;
}

export interface WorkspaceTask {
  kind: "preview" | "publish";
  projectRoot: string;
  canStop: boolean;
}
