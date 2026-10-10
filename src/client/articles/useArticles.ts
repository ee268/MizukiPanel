import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import type { ArticleListItem, ArticleRecord, ProjectReport } from "../types";
import { draftBody, frontmatterChanged, hasSourceHeaderChange, rebaseBody } from "./article-draft";
import {
  createFrontmatterRow,
  type ArticleEditorMode,
  type ArticleFilter,
  type FrontmatterRow,
} from "./types";
import { useArticleDrafts } from "./useArticleDrafts";
import type { LocalDraft } from "./local-drafts";
import type { CreationFields, CreationPreview } from "./creation-types";
import { useLiveProjectReport } from "../workspace/WorkspaceSessionProvider";
import { sessionLifecycle } from "../auth/session-lifecycle";

const ARTICLES_PER_PAGE = 10;

export function useArticles() {
  const [params, setParams] = useSearchParams();
  const tutorialOpen = params.get("tutorial") === "markdown";
  const selectedId = tutorialOpen ? null : params.get("post");
  const [loadedReport, setReport] = useState<ProjectReport | null>(null);
  const report = useLiveProjectReport(loadedReport);
  const [projectKey, setProjectKey] = useState("");
  const [articleProjectKey, setArticleProjectKey] = useState("");
  const [sourceRevision, setSourceRevision] = useState(0);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [article, setArticle] = useState<ArticleRecord | null>(null);
  const [articleLoading, setArticleLoading] = useState(Boolean(selectedId));
  const [articleLoadError, setArticleLoadError] = useState("");
  const [articleLoadAttempt, setArticleLoadAttempt] = useState(0);
  const [articleLoadVersion, setArticleLoadVersion] = useState(0);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [frontmatter, setFrontmatter] = useState<FrontmatterRow[]>([]);
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<ArticleEditorMode>("frontmatter");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ArticleFilter>("all");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(params.has("new"));
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const listScrollPosition = useRef(0);
  const shouldRestoreListScroll = useRef(false);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const frontmatterDirty = article ? frontmatterChanged(frontmatter, article) : false;
  const sourceDirty = article ? source !== article.source : false;
  const dirty = frontmatterDirty || sourceDirty;
  const currentEdit = useRef({ dirty, articleProjectKey });
  currentEdit.current = { dirty, articleProjectKey };
  const drafts = useArticleDrafts({
    projectKey: articleProjectKey,
    article,
    source,
    frontmatter,
    dirty,
    busy,
    readOnly: Boolean(report?.readOnly),
  });

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const preventExit = (event: BeforeUnloadEvent) => {
      if (sessionLifecycle.canNavigate()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventExit);
    return () => window.removeEventListener("beforeunload", preventExit);
  }, [dirty]);

  useEffect(() => {
    if (!selectedId || !dirty) {
      return;
    }

    const confirmNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest("a[href]");
      if (!link || link.getAttribute("target") === "_blank") {
        return;
      }

      const destination = new URL(link.getAttribute("href") ?? "", window.location.href);
      if (
        (destination.origin !== window.location.origin ||
          destination.pathname !== window.location.pathname) &&
        !window.confirm("当前文章有未保存的修改，确定离开吗？")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", confirmNavigation, true);
    return () => document.removeEventListener("click", confirmNavigation, true);
  }, [selectedId, dirty]);

  const loadList = useCallback(async () => {
    try {
      const data = await api<{
        report: ProjectReport;
        projectKey: string;
        articles: ArticleListItem[];
      }>("/api/articles");
      setReport(data.report);
      setProjectKey(data.projectKey);
      setArticles(data.articles);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause, "文章列表读取失败"));
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setArticle(null);
      setArticleLoading(false);
      setArticleLoadError("");
      return;
    }

    const id = selectedId;
    const controller = new AbortController();
    setArticle(null);
    setArticleLoading(true);
    setArticleLoadVersion((value) => value + 1);
    setArticleLoadError("");

    async function loadArticle() {
      try {
        const data = await api<{
          report: ProjectReport;
          projectKey: string;
          article: ArticleRecord;
          previewPath: string | null;
        }>(`/api/article?id=${encodeURIComponent(id)}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted || selectedIdRef.current !== id) return;

        setReport(data.report);
        setArticleProjectKey(data.projectKey);
        setArticle(data.article);
        setFrontmatter(data.article.frontmatter.map(createFrontmatterRow));
        setSource(data.article.source);
        setPreviewPath(data.previewPath);
        setMode(data.article.error ? "frontmatter" : "visual");
        setError("");
      } catch (cause) {
        if (controller.signal.aborted || selectedIdRef.current !== id) return;
        setArticleLoadError(errorMessage(cause, "文章读取失败"));
      } finally {
        if (!controller.signal.aborted && selectedIdRef.current === id) {
          setArticleLoading(false);
        }
      }
    }

    void loadArticle();
    return () => controller.abort();
  }, [selectedId, articleLoadAttempt]);

  useEffect(() => {
    if (params.has("new")) {
      setCreateOpen(true);
    }
  }, [params]);

  const visibleArticles = useMemo(
    () =>
      articles.filter((item) => {
        const text = `${item.title} ${item.description} ${item.id}`.toLowerCase();
        const matches = text.includes(query.trim().toLowerCase());
        const matchesState =
          filter === "all" ||
          (filter === "draft" && item.draft) ||
          (filter === "published" && !item.draft && !item.error) ||
          (filter === "invalid" && Boolean(item.error));

        return matches && matchesState;
      }),
    [articles, query, filter],
  );

  const pageCount = Math.max(1, Math.ceil(visibleArticles.length / ARTICLES_PER_PAGE));
  const pagedArticles = useMemo(() => {
    const start = (page - 1) * ARTICLES_PER_PAGE;
    return visibleArticles.slice(start, start + ARTICLES_PER_PAGE);
  }, [page, visibleArticles]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    if (selectedId || tutorialOpen || !shouldRestoreListScroll.current) {
      return;
    }

    shouldRestoreListScroll.current = false;
    let restoreFrame: number | undefined;
    const renderFrame = window.requestAnimationFrame(() => {
      restoreFrame = window.requestAnimationFrame(() => {
        window.scrollTo({ top: listScrollPosition.current, behavior: "auto" });
      });
    });

    return () => {
      window.cancelAnimationFrame(renderFrame);
      if (restoreFrame !== undefined) {
        window.cancelAnimationFrame(restoreFrame);
      }
    };
  }, [selectedId, tutorialOpen]);

  async function openTutorial() {
    if (dirty && !window.confirm("当前文章有未保存的修改，确定离开吗？")) return;
    await drafts.pause();
    listScrollPosition.current = window.scrollY;
    window.scrollTo({ top: 0, behavior: "auto" });
    setParams({ tutorial: "markdown" });
  }

  async function choose(id: string) {
    if (selectedId && dirty && !window.confirm("当前文章有未保存的修改，确定离开吗？")) {
      return;
    }
    if (!selectedId) {
      listScrollPosition.current = window.scrollY;
    }
    await drafts.pause();
    setArticle(null);
    setArticleLoading(true);
    setArticleLoadError("");
    window.scrollTo({ top: 0, behavior: "auto" });
    setParams({ post: id });
  }

  function retryArticle() {
    setArticleLoading(true);
    setArticleLoadError("");
    setArticleLoadAttempt((attempt) => attempt + 1);
  }

  async function showList() {
    if (selectedId && dirty && !window.confirm("当前文章有未保存的修改，确定返回文章列表吗？")) {
      return;
    }
    await drafts.pause();
    shouldRestoreListScroll.current = true;
    setParams({});
  }

  function changeQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function changeFilter(value: ArticleFilter) {
    setFilter(value);
    setPage(1);
  }

  function applyArticle(nextArticle: ArticleRecord, nextPreviewPath: string | null) {
    setArticle(nextArticle);
    setFrontmatter(nextArticle.frontmatter.map(createFrontmatterRow));
    setSource(nextArticle.source);
    setPreviewPath(nextPreviewPath);
  }

  function changeMode(nextMode: ArticleEditorMode) {
    setError("");
    setMode(nextMode);
  }
  async function restoreDraft(row: LocalDraft, reviewedVersion?: string) {
    if (dirty) {
      setError("当前已有未保存修改，请先手动保存或返回后重新打开文章，再恢复其他草稿。");
      return;
    }
    const id = article?.id;
    if (!id) return;
    try {
      await drafts.verify(row);
      const data = await api<{
        article: ArticleRecord;
        projectKey: string;
        report: ProjectReport;
        previewPath: string | null;
      }>(`/api/article?id=${encodeURIComponent(id)}`);
      await drafts.verify(row);
      if (data.article.version !== row.baseVersion && reviewedVersion !== data.article.version)
        throw new Error("磁盘版本已变化，请先打开草稿差异查看最新文件，再恢复；当前文件未改变。");
      if (currentEdit.current.dirty) throw new Error("读取期间编辑区已有修改，未覆盖当前输入。");
      if (
        selectedIdRef.current !== id ||
        data.projectKey !== row.projectKey ||
        row.articleId !== id
      )
        throw new Error("目标项目或文章已变化，未恢复到其他文章。");
      if (
        data.article.version !== row.baseVersion &&
        !window.confirm(
          "磁盘版本与草稿基线不同。仅将草稿放入编辑区，不写入磁盘；请先在差异视图中核对，之后手动保存才会修改文章。继续恢复？",
        )
      )
        return;
      setArticle(data.article);
      setReport(data.report);
      setPreviewPath(data.previewPath);
      drafts.markRestored(row);
      setSource(row.source);
      setFrontmatter(row.frontmatter);
      setSourceRevision((value) => value + 1);
      setNotice("草稿已恢复到编辑区，尚未写入磁盘。");
    } catch (cause) {
      setError(errorMessage(cause, "草稿恢复失败，副本仍保留"));
    }
  }

  async function saveFrontmatter() {
    if (!article) {
      return;
    }

    if (sourceDirty && hasSourceHeaderChange(source, article.source)) {
      setError("Frontmatter 修复草稿尚未保存，请先保存修复");
      return;
    }

    setBusy(true);
    await drafts.pause();
    setError("");
    try {
      const data = await api<{ article: ArticleRecord; previewPath: string | null }>(
        "/api/article/frontmatter",
        json("PUT", {
          id: article.id,
          version: article.version,
          entries: frontmatter.map(({ key, value, originalKey }) => ({ key, value, originalKey })),
          projectKey: articleProjectKey,
        }),
      );
      await drafts.clearSaved(!sourceDirty);
      if (
        selectedIdRef.current !== article.id ||
        currentEdit.current.articleProjectKey !== articleProjectKey
      )
        return;
      applyArticle(data.article, data.previewPath);
      if (sourceDirty) {
        setSource(rebaseBody(data.article.source, source));
      }
      setNotice("Frontmatter 已保存");
      await loadList();
    } catch (cause) {
      setError(errorMessage(cause, "保存失败"));
    } finally {
      setBusy(false);
    }
  }

  async function saveDocument() {
    if (!article) {
      return;
    }

    setBusy(true);
    await drafts.pause();
    setError("");
    try {
      const data = await api<{ article: ArticleRecord; previewPath: string | null }>(
        "/api/article/source",
        json("PUT", {
          id: article.id,
          version: article.version,
          source,
          projectKey: articleProjectKey,
        }),
      );
      const pendingFrontmatter = frontmatterDirty ? frontmatter : null;
      await drafts.clearSaved(!frontmatterDirty);
      if (
        selectedIdRef.current !== article.id ||
        currentEdit.current.articleProjectKey !== articleProjectKey
      )
        return;
      applyArticle(data.article, data.previewPath);
      if (pendingFrontmatter) {
        setFrontmatter(pendingFrontmatter);
      }
      setNotice(article.error ? "Frontmatter 修复已保存" : "文章正文已保存");
      await loadList();
    } catch (cause) {
      setError(errorMessage(cause, "保存失败"));
    } finally {
      setBusy(false);
    }
  }

  async function saveBody() {
    if (!article) {
      return;
    }

    const body = draftBody(source);
    if (body === null || hasSourceHeaderChange(source, article.source)) {
      setError("Frontmatter 修复草稿尚未保存，请先保存修复，再保存正文");
      return;
    }

    setBusy(true);
    await drafts.pause();
    setError("");
    try {
      const { collectSourceIslandEdits } = await import("../../lib/articles/source-island-edits");
      const sourceEdits = collectSourceIslandEdits(article.source, source, article.format);
      const data = await api<{ article: ArticleRecord; previewPath: string | null }>(
        "/api/article/body",
        json("PUT", {
          id: article.id,
          version: article.version,
          body,
          sourceEdits,
          projectKey: articleProjectKey,
        }),
      );
      const pendingFrontmatter = frontmatterDirty ? frontmatter : null;
      await drafts.clearSaved(!frontmatterDirty);
      if (
        selectedIdRef.current !== article.id ||
        currentEdit.current.articleProjectKey !== articleProjectKey
      )
        return;
      applyArticle(data.article, data.previewPath);
      if (pendingFrontmatter) {
        setFrontmatter(pendingFrontmatter);
      }
      setNotice("文章正文已保存");
      await loadList();
    } catch (cause) {
      setError(errorMessage(cause, "正文保存失败，草稿已保留"));
    } finally {
      setBusy(false);
    }
  }

  async function createArticle(fields: CreationFields, preview: CreationPreview) {
    setBusy(true);
    setError("");
    const payload = {
      ...fields,
      projectKey: preview.projectKey,
      settingsVersion: preview.settingsVersion,
      previewVersion: preview.previewVersion,
    };

    try {
      const data = await api<{ article: ArticleRecord }>("/api/articles", json("POST", payload));
      setCreateOpen(false);
      await loadList();
      await choose(data.article.id);
      setNotice("文章已创建");
    } catch (cause) {
      setError(errorMessage(cause, "创建失败"));
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  async function renameArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!article) {
      return;
    }

    if (dirty && !window.confirm("当前文章有未保存的修改，重命名后将放弃这些修改。确定继续吗？")) {
      return;
    }

    const nextId = String(new FormData(event.currentTarget).get("nextId"));
    setBusy(true);
    await drafts.pause();
    setError("");
    try {
      await api(
        "/api/article/rename",
        json("POST", {
          id: article.id,
          nextId,
          version: article.version,
          projectKey: articleProjectKey,
        }),
      );
      await drafts.relocate(nextId);
      setRenameOpen(false);
      await loadList();
      setArticle(null);
      setParams({ post: nextId });
      setNotice("文章已重命名");
    } catch (cause) {
      setError(errorMessage(cause, "重命名失败"));
    } finally {
      setBusy(false);
    }
  }

  async function removeArticle() {
    if (!article) {
      return;
    }

    if (dirty && !window.confirm("当前文章有未保存的修改，删除后将放弃这些修改。确定继续吗？")) {
      return;
    }

    setBusy(true);
    await drafts.pause();
    setError("");
    try {
      await api(
        "/api/article",
        json("DELETE", { id: article.id, version: article.version, projectKey: articleProjectKey }),
      );
      await drafts.relocate();
      setDeleteOpen(false);
      setArticle(null);
      shouldRestoreListScroll.current = true;
      setParams({});
      await loadList();
      setNotice("文章已移入回收目录");
    } catch (cause) {
      setError(errorMessage(cause, "删除失败"));
    } finally {
      setBusy(false);
    }
  }

  return {
    report,
    projectKey: article ? articleProjectKey : projectKey,
    sourceRevision,
    drafts,
    restoreDraft,
    articles,
    article,
    articleLoading,
    articleLoadVersion,
    articleLoadError,
    previewPath,
    frontmatter,
    source,
    mode,
    dirty,
    frontmatterDirty,
    sourceDirty,
    query,
    filter,
    page,
    pageCount,
    error,
    notice,
    busy,
    createOpen,
    renameOpen,
    deleteOpen,
    selectedId,
    tutorialOpen,
    pagedArticles,
    setFrontmatter,
    setSource,
    setMode: changeMode,
    setQuery: changeQuery,
    setFilter: changeFilter,
    setPage,
    setError,
    setNotice,
    setCreateOpen,
    setRenameOpen,
    setDeleteOpen,
    choose,
    openTutorial,
    retryArticle,
    showList,
    saveFrontmatter,
    saveDocument,
    saveBody,
    createArticle,
    renameArticle,
    removeArticle,
  };
}
