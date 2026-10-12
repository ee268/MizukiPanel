import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { errorMessage } from "../shared/errors";
import type { ArticleRecord } from "../types";
export type ArticleDeleteTarget = Pick<ArticleRecord, "id" | "title"> & {
  version?: string;
  projectKey: string;
};
export function useArticleDeleteTarget(projectKey: string) {
  const [target, setTarget] = useState<ArticleDeleteTarget | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    request.current?.abort();
    setTarget(null);
    setLoading(false);
    setError("");
    return () => request.current?.abort();
  }, [projectKey]);
  function close() {
    request.current?.abort();
    request.current = null;
    setTarget(null);
    setLoading(false);
    setError("");
  }
  async function open(item: Pick<ArticleRecord, "id" | "title"> & { version?: string }) {
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    setTarget({ id: item.id, title: item.title, version: item.version, projectKey });
    setError("");
    setLoading(!item.version);
    if (item.version) return;
    try {
      const data = await api<{ article: ArticleRecord; projectKey: string }>(
        `/api/article?id=${encodeURIComponent(item.id)}`,
        { signal: abort.signal },
      );
      if (abort.signal.aborted) return;
      if (data.projectKey !== projectKey) throw new Error("当前项目已切换，请重新打开删除确认框。");
      if (data.article.id !== item.id || !data.article.version)
        throw new Error("文章版本读取失败，请重新打开删除确认框。");
      setTarget({
        id: item.id,
        title: data.article.title,
        version: data.article.version,
        projectKey,
      });
    } catch (cause) {
      if (!abort.signal.aborted) setError(errorMessage(cause, "文章版本读取失败"));
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  }
  return { target, loading, error, setError, open, close };
}
