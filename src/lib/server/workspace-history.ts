import { readFile } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceHistory } from "../../shared/workspace";
import { record } from "../../shared/panel-settings";
import { assertManagedRealPath } from "./path-guard";
import { contentVersion } from "./storage";
import { defaultStateDir } from "./workspace";

const emptyHistory = (): WorkspaceHistory => ({
  schemaVersion: 1,
  revision: "initial",
  projects: {},
  recent: [],
  lastProject: null,
});
export async function readWorkspaceHistory(stateDir = defaultStateDir()) {
  let raw: string | null = null;
  try {
    raw = await readFile(await assertManagedRealPath(stateDir, "workspace-history.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (raw === null)
    return { document: emptyHistory(), version: null, readOnly: false, warnings: [] as string[] };
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !record(value) ||
      value.schemaVersion !== 1 ||
      typeof value.revision !== "string" ||
      !record(value.projects) ||
      !Array.isArray(value.recent) ||
      !(value.lastProject === null || typeof value.lastProject === "string")
    )
      throw new Error();
    for (const [key, item] of Object.entries(value.projects)) {
      if (
        !/^[a-f0-9]{64}$/.test(key) ||
        !record(item) ||
        item.id !== key ||
        typeof item.path !== "string" ||
        !path.isAbsolute(item.path) ||
        typeof item.name !== "string" ||
        typeof item.lastUsed !== "string"
      )
        throw new Error();
    }
    const projects = value.projects;
    if (
      value.recent.some((id) => typeof id !== "string" || !Object.hasOwn(projects, id)) ||
      (value.lastProject && !Object.hasOwn(projects, value.lastProject))
    )
      throw new Error();
    return {
      document: value as unknown as WorkspaceHistory,
      version: contentVersion(raw),
      readOnly: false,
      warnings: [] as string[],
    };
  } catch {
    return {
      document: emptyHistory(),
      version: contentVersion(raw),
      readOnly: true,
      warnings: ["最近项目记录损坏或来自更新版本，已暂停写入并保留原文件；自动连接已暂停。"],
    };
  }
}
