import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import type { MediaItem } from "../types";
import type { MediaData, MediaScope } from "./types";
import { imageReference, mediaAlt, type MediaPreparation } from "../../shared/media-settings";

export function useMedia() {
  const [data, setData] = useState<MediaData | null>(null);
  const [scope, setScope] = useState<MediaScope>("public");
  const [query, setQuery] = useState("");
  const [articleId, setArticleId] = useState("");
  const [folder, setFolder] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [preparation, setPreparation] = useState<MediaPreparation | null>(null);
  const [variant, setVariant] = useState<"original" | "processed" | "">("");
  const [uploaded, setUploaded] = useState<{
    reference: string;
    size: number;
    fileName: string;
    alt: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<MediaItem | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const initialized = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    try {
      const next = await api<MediaData>("/api/media");
      setData(next);
      setArticleId((current) =>
        next.articles.some((item) => item.id === current) ? current : next.articles[0]?.id || "",
      );
      if (!initialized.current) {
        initialized.current = true;
        setScope(next.preferences.values.scope);
        setFolder(next.preferences.values.folder);
      }
      return next;
    } catch (cause) {
      setError(errorMessage(cause, "媒体读取失败"));
      return null;
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
    };
  }, [load]);
  const invalidate = () => {
    generation.current += 1;
    setPreparation(null);
    setVariant("");
    setError("");
  };
  const visibleItems = useMemo(
    () =>
      data?.media.filter(
        (item) =>
          item.scope === scope && item.path.toLowerCase().includes(query.trim().toLowerCase()),
      ) ?? [],
    [data, scope, query],
  );
  async function prepare(event?: FormEvent) {
    event?.preventDefault();
    if (!file || !data || busy) return;
    const request = ++generation.current;
    setBusy(true);
    setError("");
    setPreparation(null);
    setVariant("");
    const form = new FormData();
    form.set("scope", scope);
    form.set("articleId", articleId);
    form.set("folder", folder);
    form.set("file", file);
    form.set("projectKey", data.preferences.projectKey);
    form.set("settingsVersion", data.preferences.settingsVersion ?? "");
    try {
      const next = await api<MediaPreparation>("/api/media/prepare", {
        method: "POST",
        body: form,
      });
      if (request === generation.current) {
        setPreparation(next);
        setVariant(
          next.status === "processed" && next.processedAvailable
            ? "processed"
            : next.status !== "failed" && next.originalAvailable
              ? "original"
              : "",
        );
      }
    } catch (cause) {
      if (request === generation.current)
        setError(errorMessage(cause, "图片预览失败，原文件仍保留。"));
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (!preparation || !variant || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ reference: string; size: number; fileName: string }>(
        "/api/media/commit",
        json("POST", { token: preparation.token, variant }),
      );
      setUploaded({ ...result, alt });
      setNotice(`上传成功：${result.reference}`);
      setFile(null);
      setPreparation(null);
      setVariant("");
      await load();
    } catch (cause) {
      setError(errorMessage(cause, "上传失败，未覆盖任何同名文件。"));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/media", json("DELETE", { scope: deleting.scope, path: deleting.path }));
      setDeleting(null);
      setNotice("媒体已移入回收目录");
      await load();
    } catch (cause) {
      setError(errorMessage(cause, "删除失败"));
    } finally {
      setBusy(false);
    }
  }
  async function copy(reference: string) {
    try {
      const policy = data?.preferences.values;
      let decoded = reference;
      try {
        decoded = decodeURIComponent(reference);
      } catch {
        /* Existing paths can contain literal percent signs. */
      }
      const result = imageReference(
        reference,
        mediaAlt(decoded, policy?.alt ?? "filename"),
        policy?.referenceFormat === "auto" || !policy ? "path" : policy.referenceFormat,
      );
      await navigator.clipboard.writeText(result);
      setNotice(`已复制：${result}`);
    } catch {
      setError("剪贴板不可用，请从上传结果中手动复制引用。");
    }
  }
  return {
    data,
    scope,
    query,
    articleId,
    folder,
    file,
    alt,
    preparation,
    variant,
    uploaded,
    deleting,
    error,
    notice,
    busy,
    visibleItems,
    load,
    prepare,
    upload,
    remove,
    copy,
    setAlt,
    setVariant,
    setQuery,
    setDeleting,
    setError,
    setNotice,
    setScope: (value: MediaScope) => {
      invalidate();
      setScope(value);
    },
    setArticleId: (value: string) => {
      invalidate();
      setArticleId(value);
    },
    setFolder: (value: string) => {
      invalidate();
      setFolder(value);
    },
    setFile: (value: File | null) => {
      invalidate();
      setFile(value);
      setUploaded(null);
      setAlt(mediaAlt(value?.name ?? "", data?.preferences.values.alt ?? "filename"));
      if (value && value.size > 20 * 1024 * 1024) setError("单张图片不能超过 20 MB。");
    },
    refresh: async () => {
      invalidate();
      await load();
    },
    resetDefaults: () => {
      invalidate();
      if (data) {
        setScope(data.preferences.values.scope);
        setFolder(data.preferences.values.folder);
        setAlt(mediaAlt(file?.name ?? "", data.preferences.values.alt));
      }
    },
  };
}
