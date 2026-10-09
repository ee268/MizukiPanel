import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { RecentProject, WorkspaceHistory, WorkspaceTask } from "../../shared/workspace";
import { record } from "../../shared/panel-settings";
import { inspectProject, ProjectError, type ProjectReport } from "./project";
import { readPanelSettings, savePanelSettings, settingsProjectKey } from "./panel-settings";
import { defaultStateDir, readWorkspacePath } from "./workspace";
import { assertManagedRealPath } from "./path-guard";
import { contentVersion, StorageConflict, writeManagedFile } from "./storage";
import { stopPreview, workspacePreviewTask } from "./preview";
import { workspacePublishTask } from "./publish";

export class WorkspaceError extends Error {}
export class WorkspaceTaskError extends WorkspaceError {
  constructor(public task: WorkspaceTask) {
    super(
      task.canStop
        ? "切换前需要停止由面板启动的预览。"
        : "发布任务正在运行，请等待完成后切换项目。",
    );
  }
}
const emptyHistory = (): WorkspaceHistory => ({
  schemaVersion: 1,
  revision: "initial",
  projects: {},
  recent: [],
  lastProject: null,
});
const identity = (root: string) =>
  contentVersion(
    process.platform === "win32" ? path.resolve(root).toLowerCase() : path.resolve(root),
  );

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

export async function projectWithPreferences(
  report: ProjectReport,
  stateDir = defaultStateDir(),
): Promise<ProjectReport> {
  const settings = await readPanelSettings(
    "project",
    await settingsProjectKey(report.root),
    stateDir,
  );
  const preferenceReadOnly = settings.document.values.access.readOnly === true;
  return {
    ...report,
    detectedReadOnly: report.readOnly,
    preferenceReadOnly,
    settingsReadOnly: settings.readOnly,
    readOnly: report.readOnly || preferenceReadOnly || settings.readOnly,
    warnings: [
      ...report.warnings,
      ...(preferenceReadOnly ? ["当前项目已通过面板设置设为只读。"] : []),
      ...settings.warnings.map((w) => `项目设置：${w}`),
    ],
  };
}

type Dependencies = {
  inspect: typeof inspectProject;
  preview: () => WorkspaceTask | null;
  publish: () => WorkspaceTask | null;
  stop: (report: ProjectReport) => Promise<unknown>;
};
export class WorkspaceSession {
  version = randomUUID();
  private activePath: string | null = null;
  private attemptedPath: string | null = null;
  private startupError: string | null = null;
  private ready: Promise<void> | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    public stateDir = defaultStateDir(),
    private deps: Dependencies = {
      inspect: inspectProject,
      preview: workspacePreviewTask,
      publish: workspacePublishTask,
      stop: stopPreview,
    },
  ) {}

  async initialize() {
    this.ready ??= this.startup();
    await this.ready;
  }
  private async store(
    history: Awaited<ReturnType<typeof readWorkspaceHistory>>,
    document: WorkspaceHistory,
  ) {
    if (history.readOnly) throw new WorkspaceError(history.warnings[0]);
    await mkdir(this.stateDir, { recursive: true });
    await writeManagedFile(
      this.stateDir,
      "workspace-history.json",
      JSON.stringify({ ...document, revision: randomUUID() }, null, 2) + "\n",
      history.version,
      path.join(this.stateDir, "backups", "workspace"),
    );
  }
  private async startup() {
    try {
      const machine = await readPanelSettings("machine", undefined, this.stateDir);
      let history = await readWorkspaceHistory(this.stateDir);
      if (machine.readOnly || history.readOnly) {
        this.startupError = [...machine.warnings, ...history.warnings].join("；");
        return;
      }
      if (history.version === null) {
        const legacy = await readWorkspacePath(this.stateDir);
        if (legacy && path.isAbsolute(legacy)) {
          let root = legacy;
          try {
            root = (await this.deps.inspect(legacy)).root;
          } catch {
            /* Keep an unavailable legacy path for explicit repair. */
          }
          const id = identity(root);
          const item = {
            id,
            path: root,
            name: path.basename(root),
            lastUsed: new Date().toISOString(),
          };
          await this.store(history, {
            ...history.document,
            projects: { [id]: item },
            recent: [id],
            lastProject: id,
          });
          history = await readWorkspaceHistory(this.stateDir);
        }
      }
      const policy = machine.document.values.workspace;
      if (policy.startup === "none") return;
      const selected =
        policy.startup === "default" ? String(policy.defaultProject) : history.document.lastProject;
      if (!selected) {
        if (policy.startup === "default") this.startupError = "尚未指定默认项目，未自动连接。";
        return;
      }
      const item = history.document.projects[selected];
      if (!item) {
        this.startupError = "默认项目的路径记录不可用，请重新选择或关联；未连接其他项目。";
        return;
      }
      this.attemptedPath = item.path;
      const report = await this.deps.inspect(item.path);
      if ((await settingsProjectKey(report.root)) !== item.id)
        throw new WorkspaceError("保存路径对应的项目标识已变化，请重新关联项目。");
      this.activePath = report.root;
      this.attemptedPath = null;
    } catch (error) {
      this.startupError = error instanceof Error ? error.message : "启动项目读取失败。";
    }
  }
  async currentReport() {
    await this.initialize();
    if (!this.activePath) throw new WorkspaceError(this.startupError || "请先连接 Mizuki 工作区");
    return projectWithPreferences(await this.deps.inspect(this.activePath), this.stateDir);
  }
  async active() {
    await this.initialize();
    return this.activePath;
  }
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work, work);
    this.tail = next.catch(() => {});
    return next;
  }
  private assertVersion(version: string) {
    if (version !== this.version)
      throw new StorageConflict("工作区已被其他操作切换，请刷新后重试；原修改未写入其他项目。");
  }
  private async tasks(nextRoot: string | null, stopOwned: boolean) {
    const publishing = this.deps.publish();
    if (publishing) throw new WorkspaceTaskError(publishing);
    const preview = this.deps.preview();
    if (!preview || preview.projectRoot === nextRoot) return;
    if (!stopOwned) throw new WorkspaceTaskError(preview);
    await this.deps.stop({ root: preview.projectRoot } as ProjectReport);
    if (this.deps.preview()) throw new WorkspaceError("预览仍在停止，工作区未切换，请稍后重试。");
  }
  async connect(projectPath: string, version: string, stopOwned = false) {
    await this.initialize();
    return this.serialize(async () => {
      this.assertVersion(version);
      const report = await this.deps.inspect(projectPath);
      await projectWithPreferences(report, this.stateDir);
      const id = await settingsProjectKey(report.root);
      const machine = await readPanelSettings("machine", undefined, this.stateDir);
      const history = await readWorkspaceHistory(this.stateDir);
      await this.tasks(report.root, stopOwned);
      if (!history.readOnly) {
        const item = {
          id,
          path: report.root,
          name: path.basename(report.root),
          lastUsed: new Date().toISOString(),
        };
        await this.store(history, {
          ...history.document,
          projects: { ...history.document.projects, [id]: item },
          recent: [id, ...history.document.recent.filter((key) => key !== id)].slice(
            0,
            Number(machine.document.values.workspace.recentLimit),
          ),
          lastProject: id,
        });
      }
      this.activePath = report.root;
      this.attemptedPath = null;
      this.startupError = null;
      this.version = randomUUID();
      return this.overview();
    });
  }
  async disconnect(version: string, stopOwned = false) {
    await this.initialize();
    return this.serialize(async () => {
      this.assertVersion(version);
      const history = await readWorkspaceHistory(this.stateDir);
      await this.tasks(null, stopOwned);
      if (!history.readOnly) await this.store(history, { ...history.document, lastProject: null });
      this.activePath = null;
      this.attemptedPath = null;
      this.startupError = null;
      this.version = randomUUID();
      return this.overview();
    });
  }
  async removeRecent(id: string, version: string | null) {
    await this.initialize();
    return this.serialize(async () => {
      const history = await readWorkspaceHistory(this.stateDir);
      if (version !== history.version)
        throw new StorageConflict("最近项目已变化，请刷新列表后重试。");
      if (!history.document.recent.includes(id)) throw new WorkspaceError("最近项目记录不存在。");
      await this.store(history, {
        ...history.document,
        recent: history.document.recent.filter((key) => key !== id),
      });
      return this.overview();
    });
  }
  async reassociationPreview(id: string, projectPath: string, version: string | null) {
    await this.initialize();
    const history = await readWorkspaceHistory(this.stateDir);
    if (history.readOnly || history.version !== version)
      throw new StorageConflict("项目记录已变化或只读，请刷新后重试。");
    const previous = history.document.projects[id];
    if (!previous) throw new WorkspaceError("项目记录不存在。");
    const report = await this.deps.inspect(projectPath);
    const nextId = await settingsProjectKey(report.root);
    const oldSettings = await readPanelSettings("project", id, this.stateDir);
    const nextSettings = await readPanelSettings("project", nextId, this.stateDir);
    const machine = await readPanelSettings("machine", undefined, this.stateDir);
    const next = {
      id: nextId,
      path: report.root,
      name: path.basename(report.root),
      lastUsed: previous.lastUsed,
    };
    return {
      previous,
      next,
      oldSettingsVersion: oldSettings.version,
      machineVersion: machine.version,
      defaultChanges: machine.document.values.workspace.defaultProject === id,
      copySettings: id !== nextId && oldSettings.version !== null && nextSettings.version === null,
      previewVersion: contentVersion(
        JSON.stringify([
          id,
          nextId,
          report.root,
          history.version,
          oldSettings.version,
          nextSettings.version,
          machine.version,
        ]),
      ),
    };
  }
  async reassociate(
    id: string,
    projectPath: string,
    version: string | null,
    previewVersion: string,
  ) {
    return this.serialize(async () => {
      const preview = await this.reassociationPreview(id, projectPath, version);
      if (preview.previewVersion !== previewVersion)
        throw new StorageConflict("关联预览已过期，请重新核对路径。");
      const machine = await readPanelSettings("machine", undefined, this.stateDir);
      if (machine.version !== preview.machineVersion)
        throw new StorageConflict("本机设置已变化，请重新预览关联。");
      if (machine.document.values.workspace.defaultProject === id && machine.readOnly)
        throw new WorkspaceError("本机设置只读，无法更新默认项目关联。");
      if (this.activePath === preview.previous.path)
        throw new WorkspaceError("请先断开当前项目，再修改它的路径关联。");
      if (preview.copySettings) {
        const raw = await readFile(
          await assertManagedRealPath(this.stateDir, `project-settings/${id}.json`),
          "utf8",
        );
        if (contentVersion(raw) !== preview.oldSettingsVersion)
          throw new StorageConflict("原项目设置已变化，请重新预览关联。");
        await writeManagedFile(
          this.stateDir,
          `project-settings/${preview.next.id}.json`,
          raw,
          null,
          path.join(this.stateDir, "backups", "settings"),
        );
      }
      const history = await readWorkspaceHistory(this.stateDir);
      try {
        if (history.version !== version)
          throw new StorageConflict("最近项目记录已变化，请重新预览关联。");
        await this.store(history, {
          ...history.document,
          projects: { ...history.document.projects, [preview.next.id]: preview.next },
          recent: [
            ...new Set(history.document.recent.map((key) => (key === id ? preview.next.id : key))),
          ],
          lastProject:
            history.document.lastProject === id ? preview.next.id : history.document.lastProject,
        });
      } catch (error) {
        if (preview.copySettings)
          throw new WorkspaceError(
            "设置副本已保存，但路径记录关联失败；原记录与原设置仍保留，请刷新后重新预览。" +
              (error as Error).message,
          );
        throw error;
      }
      if (machine.document.values.workspace.defaultProject === id) {
        try {
          await savePanelSettings(
            {
              scope: "machine",
              group: "workspace",
              fields: { defaultProject: preview.next.id },
              version: machine.version,
            },
            this.stateDir,
          );
        } catch {
          throw new WorkspaceError(
            "路径记录已关联，原设置仍保留；默认项目更新失败，请刷新后重新设置默认项目。",
          );
        }
      }
      return this.overview();
    });
  }
  async overview() {
    await this.initialize();
    const history = await readWorkspaceHistory(this.stateDir);
    const machine = await readPanelSettings("machine", undefined, this.stateDir);
    const examine = async (item: RecentProject) => {
      try {
        const report = await this.deps.inspect(item.path);
        if ((await settingsProjectKey(report.root)) !== item.id)
          throw new ProjectError("路径标识变化，请重新关联。");
        return { ...item, available: true };
      } catch (error) {
        return { ...item, available: false, error: (error as Error).message };
      }
    };
    let report: ProjectReport | null = null;
    let connectionError = this.startupError;
    if (this.activePath) {
      try {
        report = await this.currentReport();
      } catch (error) {
        connectionError = (error as Error).message;
      }
    }
    const defaultKey = String(machine.document.values.workspace.defaultProject);
    return {
      connectedPath: this.activePath ?? this.attemptedPath,
      report,
      connectionError,
      version: this.version,
      historyVersion: history.version,
      historyReadOnly: history.readOnly,
      recentProjects: await Promise.all(
        history.document.recent
          .slice(0, Number(machine.document.values.workspace.recentLimit))
          .map((id) => examine(history.document.projects[id])),
      ),
      defaultProject: history.document.projects[defaultKey]
        ? await examine(history.document.projects[defaultKey])
        : null,
      warnings: [...history.warnings, ...machine.warnings],
      startupError: this.startupError,
    };
  }
}

const sessionsKey = Symbol.for("mizuki-panel.workspace-sessions");
const globals = globalThis as typeof globalThis & { [sessionsKey]?: Map<string, WorkspaceSession> };
export function workspaceSession(stateDir = defaultStateDir()) {
  const sessions = (globals[sessionsKey] ??= new Map());
  const key = path.resolve(stateDir);
  let session = sessions.get(key);
  if (!session) {
    session = new WorkspaceSession(key);
    sessions.set(key, session);
  }
  return session;
}

let mutations: Promise<unknown> = Promise.resolve();
export function serializeWorkspaceMutation<T>(work: () => Promise<T>): Promise<T> {
  const result = mutations.then(work, work);
  mutations = result.catch(() => {});
  return result;
}
