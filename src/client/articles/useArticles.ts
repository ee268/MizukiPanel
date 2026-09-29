import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import type { ArticleListItem, ArticleRecord, ProjectReport } from "../types";
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

  const loadArticle = useCallback(async (id: string) => {
    try {
      const data = await api<{
        report: ProjectReport;
        article: ArticleRecord;
        previewPath: string | null;
      }>(`/api/article?id=${encodeURIComponent(id)}`);
      setReport(data.report);
      setArticle(data.article);
      setFrontmatter(data.article.frontmatter.map(createFrontmatterRow));
      setSource(data.article.source);
      setPreviewPath(data.previewPath);
      setMode(data.article.error ? "source" : "frontmatter");
      setError("");
    } catch (cause) {
      setArticle(null);
      setError(errorMessage(cause, "文章读取失败"));
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) {
      void loadArticle(selectedId);
    } else {
      setArticle(null);
    }
  }, [selectedId, loadArticle]);

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
    if (!selectedId) {
      listScrollPosition.current = window.scrollY;
    }
    setParams({ post: id });
  }

  function showList() {
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

  async function saveFrontmatter() {
    if (!article) {
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
      applyArticle(data.article, data.previewPath);
      setNotice("文章源码已保存");
      await loadList();
    } catch (cause) {
      setError(errorMessage(cause, "保存失败"));
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
      choose(nextId);
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

    setBusy(true);
    setError("");
    try {
      await api("/api/article", json("DELETE", { id: article.id, version: article.version }));
      setDeleteOpen(false);
      setArticle(null);
      showList();
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
    previewPath,
    frontmatter,
    source,
    mode,
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
    setMode,
    setQuery: changeQuery,
    setFilter: changeFilter,
    setPage,
    setError,
    setNotice,
    setCreateOpen,
    setRenameOpen,
    setDeleteOpen,
    choose,
    showList,
    saveFrontmatter,
    saveSource,
    createArticle,
    renameArticle,
    removeArticle,
  };
}
