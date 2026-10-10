import type { ProjectReport } from "./project";
import { defaultStateDir } from "./workspace";
import { readPanelSettings, savePanelSettings, settingsProjectKey } from "./panel-settings";
import type { LogRetention, PreviewSettings, PublishSettings } from "../../shared/task-settings";
import { commitTypes, validCommitScope } from "../../shared/task-settings";
import type { SettingsSnapshot } from "../../shared/panel-settings";
import { groupFingerprint } from "../../shared/panel-settings";
const limits = new Map<string, LogRetention>();
export function updateLogRetention(snapshot: SettingsSnapshot, stateDir = defaultStateDir()) {
  limits.set(stateDir, snapshot.document.values.logs as unknown as LogRetention);
}
export function logLimit(kind: keyof LogRetention, stateDir = defaultStateDir()): number {
  return limits.get(stateDir)?.[kind] ?? (kind === "preview" ? 300 : 500);
}
export async function readLogRetention(stateDir?: string) {
  const snapshot = await readPanelSettings("machine", undefined, stateDir);
  updateLogRetention(snapshot, stateDir);
  return snapshot;
}
export async function taskPreferences(report: ProjectReport, stateDir?: string) {
  const key = await settingsProjectKey(report.root);
  const snapshot = await readPanelSettings("project", key, stateDir);
  return {
    key,
    snapshot,
    preview: snapshot.document.values.preview as unknown as PreviewSettings,
    publish: snapshot.document.values.publish as unknown as PublishSettings,
  };
}
/** Remember only after a successful explicit commit; never turn a preference failure into a failed commit. */
export async function rememberPublishDefaults(
  report: ProjectReport,
  baseline: Awaited<ReturnType<typeof taskPreferences>>,
  message: string,
  stateDir?: string,
): Promise<string | null> {
  if (!baseline.publish.remember) return null;
  const match = /^([a-z]+)(?:\(([^)]+)\))?!?:/.exec(message.trim());
  if (
    !match ||
    !commitTypes.includes(match[1] as (typeof commitTypes)[number]) ||
    !validCommitScope(match[2] ?? "")
  )
    return "提交已完成，但类型/作用域不属于支持的默认值，未记忆。";
  try {
    const current = await taskPreferences(report, stateDir);
    if (
      current.key !== baseline.key ||
      groupFingerprint(current.publish) !== groupFingerprint(baseline.publish)
    )
      return "提交已完成，但发布偏好已变化，未覆盖新的默认值。";
    if (current.publish.type === match[1] && current.publish.scope === (match[2] ?? ""))
      return null;
    await savePanelSettings(
      {
        scope: "project",
        projectKey: current.key,
        group: "publish",
        version: current.snapshot.version,
        fields: { type: match[1], scope: match[2] ?? "" },
      },
      stateDir,
    );
    return null;
  } catch (error) {
    return `提交已完成，但发布默认值未保存：${(error as Error).message}`;
  }
}
