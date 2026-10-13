import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import {
  createArticle,
  deleteArticle,
  permanentlyDeleteArticle,
  readArticle,
} from "../src/lib/server/articles";
import {
  conversationFile,
  readConversations,
  saveConversations,
  withConversationFile,
} from "../src/lib/server/ai-conversations";
import { MaintenanceStore } from "../src/lib/server/maintenance";
import { withWorkspaceState } from "../src/lib/server/workspace-state";
import type { ProjectReport } from "../src/lib/server/project";
import { createWritingSession } from "../src/client/ai/conversations";
import { defaultAiWritingSettings } from "../src/shared/ai-writing";
import { storeConversations } from "../src/shared/ai-conversations";
import {
  RECYCLED_ARTICLE,
  RECYCLED_CONVERSATIONS,
  restoreArticleConversations,
} from "../src/lib/server/article-conversation-recovery";
import { readPanelSettings, savePanelSettings } from "../src/lib/server/panel-settings";

vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof fs>();
  return { ...actual, rm: vi.fn(actual.rm), writeFile: vi.fn(actual.writeFile) };
});
const roots: string[] = [];
afterEach(async () => {
  const actual = await vi.importActual<typeof fs>("node:fs/promises");
  vi.mocked(fs.rm).mockReset().mockImplementation(actual.rm);
  vi.mocked(fs.writeFile).mockReset().mockImplementation(actual.writeFile);
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

async function fixture(mode: "local" | "external" = "local") {
  const root = await fs.mkdtemp(path.join(tmpdir(), "mizuki-article-sessions-"));
  roots.push(root);
  const project = path.join(root, "project"),
    state = path.join(root, "state");
  const content = mode === "external" ? path.join(root, "content") : project;
  await fs.mkdir(project);
  await fs.mkdir(content, { recursive: true });
  await fs.mkdir(state);
  const report: ProjectReport = {
    root: project,
    contentRoot: content,
    requestedPath: project,
    mode,
    readOnly: false,
    warnings: [],
    mappings: [],
  };
  const run = <T>(work: () => T) => withWorkspaceState(state, work);
  await run(() =>
    createArticle(report, "one.md", { title: "One", published: "2026-10-13", draft: true }, "body"),
  );
  const article = await readArticle(report, "one.md");
  const first = createWritingSession(defaultAiWritingSettings, 1);
  const second = createWritingSession(defaultAiWritingSettings, 2);
  first.name = "阅读正文";
  first.input = "未发送草稿";
  second.name = "修改摘要";
  const document = storeConversations([first, second], second.id);
  const saved = await saveConversations(state, project, "one.md", document, null);
  const sessions = path.join(state, conversationFile(project, "one.md"));
  const source = path.join(
    content,
    mode === "external" ? "posts/one.md" : "src/content/posts/one.md",
  );
  const store = new MaintenanceStore(state);
  return { root, project, state, report, run, article, document, saved, sessions, source, store };
}

for (const mode of ["local", "external"] as const) {
  it(`recycles and restores all article sessions together in ${mode} projects`, async () => {
    const { project, state, report, run, article, document, sessions, source, store } =
      await fixture(mode);
    const sessionBytes = await fs.readFile(sessions);
    // Another article and another project are outside this deletion's scope.
    await saveConversations(state, project, "other.md", document, null);
    const otherProject = path.join(project, "other-project");
    await fs.mkdir(otherProject);
    await saveConversations(state, otherProject, "one.md", document, null);
    const bundle = await run(() => deleteArticle(report, "one.md", article.version));
    await expect(fs.access(source)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.access(sessions)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fs.readFile(path.join(bundle, RECYCLED_ARTICLE), "utf8")).toBe(article.source);
    expect(await fs.readFile(path.join(bundle, RECYCLED_CONVERSATIONS))).toEqual(sessionBytes);
    const inventory = await store.inventory(report);
    expect(inventory.items).toHaveLength(1);
    expect(inventory.warnings).toEqual([]);
    expect(inventory.items[0]).toMatchObject({
      kind: "trash",
      restorable: true,
      bytes: Buffer.byteLength(article.source) + sessionBytes.length,
    });
    const preview = await store.restorePreview(inventory.items[0].id, report);
    await run(() => store.restore(preview.token, report));
    expect((await readArticle(report, "one.md")).source).toBe(article.source);
    expect((await readConversations(state, project, "one.md")).document).toEqual(document);
    expect(await fs.readFile(sessions)).toEqual(sessionBytes);
    expect((await readConversations(state, project, "other.md")).document).toEqual(document);
    expect((await readConversations(state, otherProject, "one.md")).document).toEqual(document);
    expect((await store.inventory(report)).items[0].restorable).toBe(false);
    expect(await fs.readFile(path.join(bundle, RECYCLED_CONVERSATIONS))).toEqual(sessionBytes);
  });
}

it("permanently deletes only the selected article's sessions and leaves no recovery payload or temporary files", async () => {
  const { project, state, report, run, article, document, sessions, source, store } =
    await fixture();
  await saveConversations(state, project, "other.md", document, null);
  await run(() => permanentlyDeleteArticle(report, "one.md", article.version));
  await expect(fs.access(source)).rejects.toThrow();
  await expect(fs.access(sessions)).rejects.toThrow();
  expect((await readConversations(state, project, "other.md")).document).toEqual(document);
  expect((await store.inventory(report)).items).toEqual([]);
  expect(await fs.readdir(path.dirname(sessions))).toEqual([
    path.basename(conversationFile(project, "other.md")),
  ]);
});

it.each([true, false])(
  "preserves both sources after a stale version or article lock (recycle=%s)",
  async (recycle) => {
    const { report, run, article, sessions, source, store } = await fixture();
    const before = await fs.readFile(sessions);
    const remove = (version: string) =>
      run(() =>
        recycle
          ? deleteArticle(report, "one.md", version)
          : permanentlyDeleteArticle(report, "one.md", version),
      );
    await expect(remove("stale")).rejects.toThrow("已改变");
    await fs.writeFile(source + ".mizuki-panel.lock", "busy");
    await expect(remove(article.version)).rejects.toThrow("其他操作");
    await fs.rm(source + ".mizuki-panel.lock");
    expect(await fs.readFile(source, "utf8")).toBe(article.source);
    expect(await fs.readFile(sessions)).toEqual(before);
    expect((await store.inventory(report)).items).toEqual([]);
  },
);

it("rolls back both sources when indexing or article removal fails", async () => {
  const { report, run, article, sessions, source, store } = await fixture();
  const before = await fs.readFile(sessions);
  vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error("index denied"));
  await expect(run(() => deleteArticle(report, "one.md", article.version))).rejects.toThrow(
    "index denied",
  );
  const actual = await vi.importActual<typeof fs>("node:fs/promises");
  vi.mocked(fs.rm).mockImplementation(async (filename, options) => {
    if (filename === source) throw new Error("article removal denied");
    return actual.rm(filename, options);
  });
  for (const remove of [deleteArticle, permanentlyDeleteArticle])
    await expect(run(() => remove(report, "one.md", article.version))).rejects.toThrow(
      "article removal denied",
    );
  expect(await fs.readFile(source, "utf8")).toBe(article.source);
  expect(await fs.readFile(sessions)).toEqual(before);
  expect((await store.inventory(report)).items).toEqual([]);
});

it("does not overwrite conversations created before or after recovery preview", async () => {
  const { project, state, report, run, article, document, store } = await fixture();
  await run(() => deleteArticle(report, "one.md", article.version));
  const item = (await store.inventory(report)).items[0];
  const preview = await store.restorePreview(item.id, report);
  await saveConversations(state, project, "one.md", document, null);
  await expect(run(() => store.restore(preview.token, report))).rejects.toThrow("已改变");
  await expect(store.restorePreview(item.id, report)).rejects.toThrow("已有 AI 会话");
  expect((await readConversations(state, project, "one.md")).document).toEqual(document);
  await expect(readArticle(report, "one.md")).rejects.toMatchObject({ code: "ENOENT" });
});

it("preserves corrupt session bytes for recycling and removes them on permanent deletion", async () => {
  const { project, state, report, run, article, sessions, store } = await fixture();
  const corrupt = "{ broken original sessions";
  await fs.writeFile(sessions, corrupt);
  await run(() => deleteArticle(report, "one.md", article.version));
  const item = (await store.inventory(report)).items[0];
  const preview = await store.restorePreview(item.id, report);
  await run(() => store.restore(preview.token, report));
  expect(await fs.readFile(sessions, "utf8")).toBe(corrupt);
  await expect(readConversations(state, project, "one.md")).rejects.toThrow("损坏");
  await run(() => permanentlyDeleteArticle(report, "one.md", article.version));
  await expect(fs.access(sessions)).rejects.toThrow();
});

it("protects tampered bundle bytes and preserves both recovery files", async () => {
  const { report, run, article, store } = await fixture();
  const bundle = await run(() => deleteArticle(report, "one.md", article.version));
  const item = (await store.inventory(report)).items[0];
  const preview = await store.restorePreview(item.id, report);
  await fs.writeFile(path.join(bundle, RECYCLED_CONVERSATIONS), "changed");
  await expect(run(() => store.restore(preview.token, report))).rejects.toThrow("已改变");
  expect((await store.inventory(report)).items[0]).toMatchObject({
    restorable: false,
    protected: true,
  });
  expect(await fs.readFile(path.join(bundle, RECYCLED_ARTICLE), "utf8")).toBe(article.source);
});

it("serializes conversation saves with article removal and rejects saves after article disappearance", async () => {
  const { project, state, report, run, article, document, saved, sessions } = await fixture();
  await withConversationFile(state, project, "one.md", async () => {
    await expect(
      saveConversations(state, project, "one.md", document, saved.version),
    ).rejects.toThrow("其他操作");
    await expect(run(() => deleteArticle(report, "one.md", article.version))).rejects.toThrow(
      "其他操作",
    );
  });
  await run(() => permanentlyDeleteArticle(report, "one.md", article.version));
  await expect(
    saveConversations(state, project, "one.md", document, null, () =>
      readArticle(report, "one.md"),
    ),
  ).rejects.toMatchObject({ code: "ENOENT" });
  await expect(fs.access(sessions)).rejects.toThrow();
});

it("cleans the entire older recycle bundle as one item and preserves the latest bundle", async () => {
  const { state, report, run, article, store } = await fixture();
  const old = await run(() => deleteArticle(report, "one.md", article.version));
  const metadata = JSON.parse(await fs.readFile(old + ".meta.json", "utf8"));
  metadata.createdAt = "2000-01-01T00:00:00.000Z";
  await fs.writeFile(old + ".meta.json", JSON.stringify(metadata));
  const item = (await store.inventory(report)).items[0];
  const restore = await store.restorePreview(item.id, report);
  await run(() => store.restore(restore.token, report));
  const latest = await run(() => deleteArticle(report, "one.md", article.version));
  const settings = await readPanelSettings("machine", undefined, state);
  await savePanelSettings(
    {
      scope: "machine",
      group: "maintenance",
      fields: { enabled: true, count: 1, days: 1 },
      version: settings.version,
    },
    state,
  );
  const preview = await store.cleanupPreview(report, "trash");
  expect(preview.items).toHaveLength(1);
  expect((await store.cleanup(preview.token, [item.id], report)).results[0].success).toBe(true);
  await expect(fs.access(old)).rejects.toThrow();
  await expect(fs.access(old + ".meta.json")).rejects.toThrow();
  await fs.access(path.join(latest, RECYCLED_ARTICLE));
  await fs.access(path.join(latest, RECYCLED_CONVERSATIONS));
  expect((await store.inventory(report)).items).toHaveLength(1);
});

it("rolls back restored sessions when article recreation fails", async () => {
  const { state, project, report, run, article, sessions, source, store } = await fixture();
  const bundle = await run(() => deleteArticle(report, "one.md", article.version));
  const metadata = JSON.parse(await fs.readFile(bundle + ".meta.json", "utf8"));
  await expect(
    restoreArticleConversations(state, project, "one.md", bundle, metadata.digest, async () => {
      throw new Error("article validation failed");
    }),
  ).rejects.toThrow("article validation failed");
  await expect(fs.access(sessions)).rejects.toThrow();
  await expect(fs.access(source)).rejects.toThrow();
  expect((await store.inventory(report)).items[0].restorable).toBe(true);
  expect(await fs.readdir(path.dirname(sessions))).toEqual([]);
});
