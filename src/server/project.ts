import type { ProjectReport } from "../lib/server/project";
import { workspaceSession } from "../lib/server/workspace-session";
import { defaultStateDir } from "../lib/server/workspace";

export { withWorkspaceState } from "../lib/server/workspace-state";

export async function currentProject(stateDir = defaultStateDir()): Promise<ProjectReport> {
  return workspaceSession(stateDir).currentReport();
}
