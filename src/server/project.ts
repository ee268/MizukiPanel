import { AsyncLocalStorage } from "node:async_hooks";
import type { ProjectReport } from "../lib/server/project";
import { workspaceSession } from "../lib/server/workspace-session";
import { defaultStateDir } from "../lib/server/workspace";

const state = new AsyncLocalStorage<string>();
export const withWorkspaceState = <T>(directory: string, action: () => T): T =>
  state.run(directory, action);

export async function currentProject(
  stateDir = state.getStore() ?? defaultStateDir(),
): Promise<ProjectReport> {
  return workspaceSession(stateDir).currentReport();
}
