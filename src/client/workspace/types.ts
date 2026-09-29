import type { DashboardOverview, ProjectReport } from "../types";

export interface WorkspaceData {
  connectedPath: string | null;
  report: ProjectReport | null;
  connectionError: string | null;
}

export interface WorkspaceState {
  data: WorkspaceData | null;
  dashboard: DashboardOverview | null;
  projectPath: string;
  error: string;
  dashboardError: string;
  busy: boolean;
  loading: boolean;
}
