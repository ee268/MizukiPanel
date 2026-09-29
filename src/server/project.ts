import { inspectProject, type ProjectReport } from "../lib/server/project";
import { readWorkspacePath } from "../lib/server/workspace";
import { ApiError } from "./errors";

export async function currentProject(): Promise<ProjectReport> {
  const workspace = await readWorkspacePath();
  if (!workspace) {
    throw new ApiError(400, "请先连接 Mizuki 工作区");
  }
  return inspectProject(workspace);
}
