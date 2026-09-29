import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, json } from "../api";
import type { MediaItem } from "../types";
import type { MediaData, MediaScope } from "./types";

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function useMedia() {
  const [data, setData] = useState<MediaData | null>(null);
  const [scope, setScope] = useState<MediaScope>("public");
  const [query, setQuery] = useState("");
  const [articleId, setArticleId] = useState("");
  const [folder, setFolder] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [deleting, setDeleting] = useState<MediaItem | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await api<MediaData>("/api/media");
      setData(next);
      setArticleId((current) => current || next.articles[0]?.id || "");
      setError("");
    } catch (cause) {
      setError(message(cause, "媒体读取失败"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleItems = useMemo(
    () =>
      data?.media.filter(
        (item) =>
          item.scope === scope && item.path.toLowerCase().includes(query.trim().toLowerCase()),
      ) ?? [],
    [data, scope, query],
  );

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      return;
    }

    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("scope", scope);
    form.set("articleId", articleId);
    form.set("folder", folder);
    form.set("file", file);
    try {
      const result = await api<{ reference: string }>("/api/media", {
        method: "POST",
        body: form,
      });
      setNotice(`上传成功：${result.reference}`);
      setFile(null);
      await load();
    } catch (cause) {
      setError(message(cause, "上传失败"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      await api("/api/media", json("DELETE", { scope: deleting.scope, path: deleting.path }));
      setDeleting(null);
      setNotice("媒体已移入回收目录");
      await load();
    } catch (cause) {
      setError(message(cause, "删除失败"));
    } finally {
      setBusy(false);
    }
  }

  async function copy(reference: string) {
    await navigator.clipboard.writeText(reference);
    setNotice(`已复制：${reference}`);
  }

  return {
    data,
    scope,
    query,
    articleId,
    folder,
    file,
    deleting,
    error,
    notice,
    busy,
    visibleItems,
    setScope,
    setQuery,
    setArticleId,
    setFolder,
    setFile,
    setDeleting,
    setError,
    setNotice,
    upload,
    remove,
    copy,
  };
}
