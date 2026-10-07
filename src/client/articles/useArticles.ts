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

const ARTICLES_PER_PAGE = 10;

export function useArticles() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("post");
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [article, setArticle] = useState<ArticleRecord | null>(null);
  const [articleLoading, setArticleLoading] = useState(Boolean(selectedId));
  const [articleLoadError, setArticleLoadError] = useState("");
  const [articleLoadAttempt, setArticleLoadAttempt] = useState(0);
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

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const preventExit = (event: BeforeUnloadEvent) => {
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
      const data = await api<{ report: ProjectReport; articles: ArticleListItem[] }>(
        "/api/articles",
      );
      setReport(data.report);
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
    setArticleLoadError("");

    async function loadArticle() {
      try {
        const data = await api<{
          report: ProjectReport;
          article: ArticleRecord;
          previewPath: string | null;
        }>(`/api/article?id=${encodeURIComponent(id)}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted || selectedIdRef.current !== id) return;

        setReport(data.report);
        setArticle(data.article);
        setFrontmatter(data.article.frontmatter.map(createFrontmatterRow));
        setSource(data.article.source);
        setPreviewPath(data.previewPath);
        setMode(data.article.error ? "source" : "visual");
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
    if (selectedId || !shouldRestoreListScroll.current) {
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
  }, [selectedId]);

  function choose(id: string) {
    if (selectedId && dirty && !window.confirm("当前文章有未保存的修改，确定离开吗？")) {
      return;
    }
    if (!selectedId) {
      listScrollPosition.current = window.scrollY;
    }
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

  function showList() {
    if (dirty && !window.confirm("当前文章有未保存的修改，确定返回文章列表吗？")) {
      return;
    }
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

  async function saveFrontmatter() {
    if (!article) {
      return;
    }

    if (sourceDirty && hasSourceHeaderChange(source, article.source)) {
      setError("完整源码中的 Frontmatter 也已修改，请先在完整源码模式保存或撤销该修改");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const data = await api<{ article: ArticleRecord; previewPath: string | null }>(
        "/api/article/frontmatter",
        json("PUT", {
          id: article.id,
          version: article.version,
          entries: frontmatter.map(({ key, value, originalKey }) => ({ key, value, originalKey })),
        }),
      );
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

  async function saveSource() {
    if (!article) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      const data = await api<{ article: ArticleRecord; previewPath: string | null }>(
        "/api/article/source",
        json("PUT", { id: article.id, version: article.version, source }),
      );
      const pendingFrontmatter = frontmatterDirty ? frontmatter : null;
      applyArticle(data.article, data.previewPath);
      if (pendingFrontmatter) {
        setFrontmatter(pendingFrontmatter);
      }
      setNotice("文章源码已保存");
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
      setError("完整源码中的 Frontmatter 已修改，请先保存完整源码，再保存正文");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { collectSourceIslandEdits } = await import("../../lib/articles/source-island-edits");
      const sourceEdits = collectSourceIslandEdits(article.source, source, article.format);
      const data = await api<{ article: ArticleRecord; previewPath: string | null }>(
        "/api/article/body",
        json("PUT", { id: article.id, version: article.version, body, sourceEdits }),
      );
      const pendingFrontmatter = frontmatterDirty ? frontmatter : null;
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

  async function createArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      id: String(form.get("id")),
      title: String(form.get("title")),
      published: String(form.get("published")),
      draft: form.has("draft"),
      body: String(form.get("body") ?? ""),
    };

    try {
      await api("/api/articles", json("POST", payload));
      setCreateOpen(false);
      await loadList();
      choose(payload.id);
      setNotice("文章已创建");
    } catch (cause) {
      setError(errorMessage(cause, "创建失败"));
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

    setBusy(true);
    setError("");
    const nextId = String(new FormData(event.currentTarget).get("nextId"));
    try {
      await api(
        "/api/article/rename",
        json("POST", { id: article.id, nextId, version: article.version }),
      );
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
    setError("");
    try {
      await api("/api/article", json("DELETE", { id: article.id, version: article.version }));
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
    articles,
    article,
    articleLoading,
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
    retryArticle,
    showList,
    saveFrontmatter,
    saveSource,
    saveBody,
    createArticle,
    renameArticle,
    removeArticle,
  };
}
