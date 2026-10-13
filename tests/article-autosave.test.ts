import { expect, it, vi } from "vitest";
import {
  ArticleAutoSaver,
  articleAutosaveRequest,
  articleDraftDirty,
  mergeAutosavedDraft,
  type ArticleAutosaveDraft,
} from "../src/client/articles/article-autosave";
import {
  autosaveOnExit,
  autosaveOnInterval,
  type ArticleSaveScope,
  type ArticleAutosaveRequest,
} from "../src/shared/article-autosave";
import {
  defaultPersonalSettings,
  emptyDocument,
  parseSettings,
  patchSettings,
} from "../src/shared/panel-settings";
import {
  frontmatterEntries,
  parseArticleSource,
  patchArticleFrontmatter,
} from "../src/lib/server/article-format";
import type { ArticleRecord } from "../src/client/types";
import { createFrontmatterRow } from "../src/client/articles/types";
import { exportPreferenceGroups, parsePreferenceBundle } from "../src/shared/preferences-transfer";

const source =
  "---\ntitle: 原标题\npublished: 2026-10-13\ndraft: true\ncustom: preserved\n---\n\n原始正文\n";
function record(text = source, version = "v1"): ArticleRecord {
  const parsed = parseArticleSource(text);
  return {
    id: "one.md",
    source: text,
    version,
    frontmatter: frontmatterEntries(parsed.data),
    title: String(parsed.data.title),
    description: "",
    image: "",
    published: "2026-10-13",
    draft: true,
    format: "md",
    error: null,
    alias: "",
    permalink: "",
    slug: "one",
    tags: [],
    category: "",
  };
}
function draft(): ArticleAutosaveDraft {
  const article = record();
  return {
    article,
    projectKey: "project",
    source: source.replace("原始正文", "修改正文"),
    frontmatter: article.frontmatter.map((entry) =>
      createFrontmatterRow({ ...entry, value: entry.key === "title" ? "新标题" : entry.value }),
    ),
    busy: false,
    readOnly: false,
  };
}
function harness() {
  let state = draft();
  let finish!: (value: { article: ArticleRecord; previewPath: null }) => void;
  const persist = vi.fn(
    (_input: ArticleAutosaveRequest, _keepalive: boolean) =>
      new Promise<{ article: ArticleRecord; previewPath: null }>((resolve) => {
        finish = resolve;
      }),
  );
  const accept = vi.fn(
    async (
      result: { article: ArticleRecord; previewPath: string | null },
      captured: ArticleAutosaveDraft,
      input: ArticleAutosaveRequest,
    ) => {
      state = {
        ...state,
        ...mergeAutosavedDraft(captured, state, result.article, input),
        article: result.article,
      };
    },
  );
  const flush = vi.fn();
  const saver = new ArticleAutoSaver({
    getDraft: () => ({ ...state }),
    flush,
    persist,
    accept,
    started: () => {
      state = { ...state, busy: true };
    },
    finished: () => {
      state = { ...state, busy: false };
    },
  });
  return {
    saver,
    persist,
    accept,
    flush,
    get: () => state,
    update: (patch: Partial<ArticleAutosaveDraft>) => {
      state = { ...state, ...patch };
    },
    finish: (article: ArticleRecord) => finish({ article, previewPath: null }),
  };
}

it("defaults autosave off and persists/export/import validates its settings", () => {
  expect(defaultPersonalSettings.articleAutosave).toEqual({
    enabled: false,
    scope: "both",
    trigger: "exit",
    intervalSeconds: 60,
  });
  const settings = { enabled: true, scope: "frontmatter", trigger: "both", intervalSeconds: 90 };
  const document = patchSettings(
    emptyDocument("browser"),
    "browser",
    "articleAutosave",
    settings,
    "test",
  );
  const exported = exportPreferenceGroups("browser", document.values);
  expect(
    parsePreferenceBundle(
      JSON.stringify({
        format: "mizuki-panel-preferences",
        schemaVersion: 1,
        scopes: { browser: exported },
      }),
    ).scopes.browser?.articleAutosave,
  ).toEqual(settings);
  const old = parseSettings(
    JSON.stringify({ schemaVersion: 1, values: { editor: { outline: true } } }),
    "browser",
  );
  expect(old.document.values.articleAutosave).toEqual(defaultPersonalSettings.articleAutosave);
  expect(old.document.values.editor.outline).toBe(true);
});
it.each([
  { enabled: "true" },
  { scope: "source" },
  { trigger: "always" },
  { intervalSeconds: 14 },
  { intervalSeconds: 3601 },
  { intervalSeconds: 30.5 },
])("rejects invalid autosave preference %j", (fields) => {
  expect(() =>
    patchSettings(emptyDocument("browser"), "browser", "articleAutosave", fields, "test"),
  ).toThrow();
});
it.each(["exit", "interval", "both"] as const)(
  "selects the configured autosave trigger %s",
  (trigger) => {
    const settings = { ...defaultPersonalSettings.articleAutosave, enabled: true, trigger };
    expect(autosaveOnExit(settings)).toBe(trigger !== "interval");
    expect(autosaveOnInterval(settings)).toBe(trigger !== "exit");
    expect(autosaveOnExit({ ...settings, enabled: false })).toBe(false);
    expect(autosaveOnInterval({ ...settings, enabled: false })).toBe(false);
  },
);
it.each(["body", "frontmatter", "both"] as ArticleSaveScope[])(
  "sends only selected changed parts (%s)",
  async (scope) => {
    const input = await articleAutosaveRequest(draft(), scope);
    expect(input?.body !== undefined).toBe(scope !== "frontmatter");
    expect(input?.entries !== undefined).toBe(scope !== "body");
    expect(input).toMatchObject({ id: "one.md", projectKey: "project", version: "v1" });
  },
);
it("does not rewrite unchanged content and does not send unselected invalid fields", async () => {
  const state = draft();
  state.source = state.article!.source;
  expect(await articleAutosaveRequest(state, "body")).toBeNull();
  state.source = source.replace("原始正文", "新正文");
  state.frontmatter[0].value = "[ broken yaml";
  expect((await articleAutosaveRequest(state, "body"))?.entries).toBeUndefined();
});
it.each([
  { readOnly: true },
  { busy: true },
  { source: "invalid header" },
  { article: { ...record(), error: "broken" } },
])("blocks unsafe save state %j", async (patch) => {
  await expect(articleAutosaveRequest({ ...draft(), ...patch }, "both")).rejects.toThrow();
});
it("keeps unsaved metadata when only body is saved and keeps body when only metadata is saved", async () => {
  const captured = draft();
  const body = (await articleAutosaveRequest(captured, "body"))!;
  const bodySaved = record(captured.source, "v2");
  expect(mergeAutosavedDraft(captured, captured, bodySaved, body).frontmatter).toEqual(
    captured.frontmatter,
  );
  const fields = (await articleAutosaveRequest(captured, "frontmatter"))!;
  const fieldsSaved = record(patchArticleFrontmatter(source, fields.entries!), "v2");
  const merged = mergeAutosavedDraft(captured, captured, fieldsSaved, fields);
  expect(merged.source).toContain("修改正文");
  expect(merged.source).toContain("title: 新标题");
  expect(merged.frontmatter.map(({ rowId, ...entry }) => entry)).toEqual(fieldsSaved.frontmatter);
  expect(merged.frontmatter.map((row) => row.rowId)).toEqual(
    captured.frontmatter.map((row) => row.rowId),
  );
});
it("retains edits typed during a request and rebases original keys after metadata renaming", async () => {
  const captured = draft();
  const custom = captured.frontmatter.find((row) => row.key === "custom")!;
  custom.key = "renamed";
  const input = (await articleAutosaveRequest(captured, "both"))!;
  const saved = record(patchArticleFrontmatter(captured.source, input.entries!), "v2");
  const latest = {
    ...captured,
    source: captured.source + "仍在输入\n",
    frontmatter: captured.frontmatter.map((row) =>
      row.rowId === custom.rowId ? { ...row, key: "renamedAgain", value: "新值" } : row,
    ),
  };
  const merged = mergeAutosavedDraft(captured, latest, saved, input);
  expect(merged.source).toContain("仍在输入");
  expect(merged.frontmatter.find((row) => row.rowId === custom.rowId)).toMatchObject({
    key: "renamedAgain",
    originalKey: "renamed",
    value: "新值",
  });
});
it("flushes input, serializes overlapping saves and keeps the new baseline", async () => {
  const h = harness();
  const first = h.saver.save("both"),
    second = h.saver.save("both");
  await vi.waitFor(() => expect(h.persist).toHaveBeenCalledOnce());
  const input = h.persist.mock.calls[0][0];
  h.finish(record(patchArticleFrontmatter(h.get().source, input.entries!), "v2"));
  expect(await first).toBe(true);
  expect(await second).toBe(false);
  expect(h.accept).toHaveBeenCalledOnce();
  expect(h.flush).toHaveBeenCalled();
  expect(articleDraftDirty(h.get())).toBe(false);
  expect(h.get().busy).toBe(false);
});
it("never applies a delayed result to a different article or project", async () => {
  const h = harness();
  const save = h.saver.save("both");
  await vi.waitFor(() => expect(h.persist).toHaveBeenCalledOnce());
  h.update({ projectKey: "other-project", article: { ...record(), id: "other.md" } });
  h.finish(record(source, "v2"));
  await save;
  expect(h.accept).not.toHaveBeenCalled();
  expect(h.get().article?.id).toBe("other.md");
});
it("preserves input on conflicts and pauses repeated timed attempts until a draft changes", async () => {
  const h = harness();
  h.persist.mockRejectedValue(Object.assign(new Error("disk changed"), { status: 409 }));
  await expect(h.saver.save("both", { timed: true })).rejects.toThrow("disk changed");
  expect(await h.saver.save("both", { timed: true })).toBe(false);
  expect(h.persist).toHaveBeenCalledOnce();
  expect(h.get().source).toContain("修改正文");
  h.update({ source: h.get().source + "修改" });
  await expect(h.saver.save("both", { timed: true })).rejects.toThrow("disk changed");
  expect(h.persist).toHaveBeenCalledTimes(2);
});
it("uses keepalive for small unload saves and preserves large drafts without exceeding the browser limit", async () => {
  const h = harness();
  const save = h.saver.save("body", { keepalive: true });
  await vi.waitFor(() => expect(h.persist).toHaveBeenCalledOnce());
  expect(h.persist.mock.calls[0][1]).toBe(true);
  h.finish(record(h.get().source, "v2"));
  await save;
  h.update({ source: h.get().source + "中文".repeat(20000) });
  await expect(h.saver.save("body", { keepalive: true })).rejects.toThrow("退出保存限制");
  expect(h.persist).toHaveBeenCalledOnce();
  expect(h.get().busy).toBe(false);
});
