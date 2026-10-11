import { readWorkspaceHistory } from "./workspace-history";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import {
  parseSettings,
  patchSettings,
  SettingsValidationError,
  type SettingsScope,
  type SettingsSnapshot,
} from "../../shared/panel-settings";
import { assertManagedRealPath } from "./path-guard";
import { contentVersion, StorageConflict, writeManagedFile } from "./storage";
import { defaultStateDir } from "./workspace";
import { newArticleSource } from "./article-format";
import { expandTemplate, templateDefaults } from "../../shared/panel-settings/article-template";

export async function settingsProjectKey(root: string): Promise<string> {
  const canonical = await realpath(root);
  return createHash("sha256")
    .update(process.platform === "win32" ? canonical.toLowerCase() : canonical)
    .digest("hex");
}
function relativeFile(scope: "machine" | "project", key?: string): string {
  if (scope === "machine") return "settings.json";
  if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new SettingsValidationError("项目标识无效。");
  return `project-settings/${key}.json`;
}
export async function readPanelSettings(
  scope: "machine" | "project",
  key?: string,
  stateDir = defaultStateDir(),
): Promise<SettingsSnapshot> {
  const relative = relativeFile(scope, key);
  let raw: string | null = null;
  try {
    raw = await readFile(await assertManagedRealPath(stateDir, relative), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const snapshot = parseSettings(raw, scope);
  snapshot.version = raw === null ? null : contentVersion(raw);
  delete snapshot.raw;
  return snapshot;
}
export async function savePanelSettings(
  input: {
    scope: "machine" | "project";
    group: string;
    fields: unknown;
    version: string | null;
    projectKey?: string;
  },
  stateDir = defaultStateDir(),
): Promise<SettingsSnapshot> {
  return savePanelSettingsGroups({ ...input, groups: { [input.group]: input.fields } }, stateDir);
}
export async function savePanelSettingsGroups(
  input: {
    scope: "machine" | "project";
    groups: Record<string, unknown>;
    version: string | null;
    projectKey?: string;
  },
  stateDir = defaultStateDir(),
): Promise<SettingsSnapshot> {
  await mkdir(stateDir, { recursive: true });
  const current = await readPanelSettings(input.scope, input.projectKey, stateDir);
  if (current.version !== input.version)
    throw new StorageConflict("设置已被其他操作修改，请重新读取后保存。");
  if (current.readOnly) throw new SettingsValidationError(current.warnings[0]);
  if (!Object.keys(input.groups).length) throw new SettingsValidationError("请选择设置分组。");
  let next = current.document;
  for (const [group, fields] of Object.entries(input.groups))
    next = patchSettings(next, input.scope as SettingsScope, group, fields, randomUUID());
  if (
    input.scope === "machine" &&
    Object.hasOwn(input.groups, "workspace") &&
    next.values.workspace.defaultProject
  ) {
    const history = await readWorkspaceHistory(stateDir);
    if (!Object.hasOwn(history.document.projects, String(next.values.workspace.defaultProject)))
      throw new SettingsValidationError("默认项目必须来自已连接过的项目记录。");
  }
  if (input.scope === "project" && Object.hasOwn(input.groups, "articleTemplate")) {
    try {
      const values = next.values.articleTemplate;
      const variables = {
        title: "示例文章",
        date: "2026-10-09",
        today: "2026-10-09",
        year: "2026",
        month: "10",
        day: "09",
        slug: "example",
      };
      newArticleSource(
        { title: variables.title, published: variables.date, draft: true },
        expandTemplate(values.body as string, variables),
        templateDefaults(values.frontmatter as string, variables),
      );
    } catch (cause) {
      throw new SettingsValidationError(`模板默认字段无效：${(cause as Error).message}`);
    }
  }
  await writeManagedFile(
    stateDir,
    relativeFile(input.scope, input.projectKey),
    JSON.stringify(next, null, 2) + "\n",
    current.version,
    path.join(stateDir, "backups", "settings"),
    { domain: "settings" },
  );
  return readPanelSettings(input.scope, input.projectKey, stateDir);
}
