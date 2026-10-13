import type { ArticleRecord } from "../types";
import type { ArticleAutosaveRequest, ArticleSaveScope } from "../../shared/article-autosave";
import { draftBody, frontmatterChanged, hasSourceHeaderChange, rebaseBody } from "./article-draft";
import { createFrontmatterRow, type FrontmatterRow } from "./types";

export interface ArticleAutosaveDraft {
  article: ArticleRecord | null;
  projectKey: string;
  source: string;
  frontmatter: FrontmatterRow[];
  busy: boolean;
  readOnly: boolean;
}
export function articleDraftDirty(draft: ArticleAutosaveDraft): boolean {
  return Boolean(
    draft.article &&
    (draft.source !== draft.article.source || frontmatterChanged(draft.frontmatter, draft.article)),
  );
}
export function selectedArticleDirty(
  draft: ArticleAutosaveDraft,
  scope: ArticleSaveScope,
): boolean {
  return Boolean(
    draft.article &&
    ((scope !== "frontmatter" && draft.source !== draft.article.source) ||
      (scope !== "body" && frontmatterChanged(draft.frontmatter, draft.article))),
  );
}
const target = (draft: ArticleAutosaveDraft) => `${draft.projectKey}:${draft.article?.id ?? ""}`;
const fingerprint = (draft: ArticleAutosaveDraft, scope: ArticleSaveScope) =>
  JSON.stringify([target(draft), draft.article?.version, scope, draft.source, draft.frontmatter]);

export async function articleAutosaveRequest(
  draft: ArticleAutosaveDraft,
  scope: ArticleSaveScope,
): Promise<ArticleAutosaveRequest | null> {
  const article = draft.article;
  if (!article || !draft.projectKey) return null;
  const bodyChanged = scope !== "frontmatter" && draft.source !== article.source;
  const fieldsChanged = scope !== "body" && frontmatterChanged(draft.frontmatter, article);
  if (!bodyChanged && !fieldsChanged) return null;
  if (draft.readOnly) throw new Error("当前工作区只读，未自动保存。");
  if (draft.busy) throw new Error("文章正在保存或处理其他操作，请稍后重试。");
  if (article.error || hasSourceHeaderChange(draft.source, article.source))
    throw new Error("请先手动修复并保存 Frontmatter，自动保存未修改文件。");
  const input: ArticleAutosaveRequest = {
    id: article.id,
    projectKey: draft.projectKey,
    version: article.version,
  };
  if (bodyChanged) {
    const body = draftBody(draft.source);
    if (body === null) throw new Error("无法读取正文，请先修复 Frontmatter。");
    const { collectSourceIslandEdits } = await import("../../lib/articles/source-island-edits");
    input.body = body;
    input.sourceEdits = collectSourceIslandEdits(article.source, draft.source, article.format);
  }
  if (fieldsChanged)
    input.entries = draft.frontmatter.map(({ key, value, originalKey }) => ({
      key,
      value,
      originalKey,
    }));
  return input;
}

/** Rebase the saved baseline, retaining edits made after the request and the unselected part. */
export function mergeAutosavedDraft(
  captured: ArticleAutosaveDraft,
  latest: ArticleAutosaveDraft,
  saved: ArticleRecord,
  input: ArticleAutosaveRequest,
): Pick<ArticleAutosaveDraft, "source" | "frontmatter"> {
  const source =
    input.body !== undefined && latest.source === captured.source
      ? saved.source
      : hasSourceHeaderChange(latest.source, captured.article!.source)
        ? latest.source
        : rebaseBody(saved.source, latest.source);
  const sameFields = JSON.stringify(latest.frontmatter) === JSON.stringify(captured.frontmatter);
  const frontmatter =
    input.entries !== undefined && sameFields
      ? saved.frontmatter.map((entry) => ({
          ...entry,
          rowId:
            captured.frontmatter.find((row) => row.key === entry.key)?.rowId ??
            createFrontmatterRow(entry).rowId,
        }))
      : latest.frontmatter.map((row) => {
          if (input.entries === undefined) return row;
          const sent = captured.frontmatter.find((before) => before.rowId === row.rowId);
          return sent ? { ...row, originalKey: sent.key } : row;
        });
  return { source, frontmatter };
}

export class ArticleAutoSaver {
  private pending: Promise<boolean> | null = null;
  private failed: string | null = null;
  constructor(
    private options: {
      getDraft: () => ArticleAutosaveDraft;
      flush: () => void;
      persist: (
        input: ArticleAutosaveRequest,
        keepalive: boolean,
      ) => Promise<{ article: ArticleRecord; previewPath: string | null }>;
      accept: (
        result: { article: ArticleRecord; previewPath: string | null },
        captured: ArticleAutosaveDraft,
        input: ArticleAutosaveRequest,
      ) => Promise<void>;
      started: () => void;
      finished: () => void;
    },
  ) {}
  async save(
    scope: ArticleSaveScope,
    options: { keepalive?: boolean; timed?: boolean } = {},
  ): Promise<boolean> {
    const originalTarget = target(this.options.getDraft());
    if (this.pending) {
      await this.pending;
      if (target(this.options.getDraft()) !== originalTarget) return false;
      return this.save(scope, options);
    }
    this.options.flush();
    const draft = this.options.getDraft();
    if (!selectedArticleDirty(draft, scope)) return false;
    const signature = fingerprint(draft, scope);
    if (options.timed && this.failed === signature) return false;
    // Reserve synchronously before asynchronous syntax analysis, preventing overlapping saves.
    if (draft.busy) {
      if (options.timed) return false;
      throw new Error("文章正在保存或处理其他操作，请稍后重试。");
    }
    this.options.started();
    const work = async () => {
      try {
        const input = await articleAutosaveRequest(draft, scope);
        if (!input) return false;
        if (options.keepalive && new TextEncoder().encode(JSON.stringify(input)).length > 60 * 1024)
          throw new Error("文章内容超过浏览器退出保存限制，请先保存或通过页面导航离开。");
        const result = await this.options.persist(input, Boolean(options.keepalive));
        if (target(this.options.getDraft()) === originalTarget)
          await this.options.accept(result, draft, input);
        this.failed = null;
        return true;
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 400 || status === 409 || status === undefined) this.failed = signature;
        throw error;
      } finally {
        this.options.finished();
      }
    };
    const pending = work();
    this.pending = pending;
    try {
      return await pending;
    } finally {
      if (this.pending === pending) this.pending = null;
    }
  }
}
