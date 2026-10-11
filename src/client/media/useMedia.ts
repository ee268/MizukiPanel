import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import { matchesProjectImage, type ProjectImage } from "../../shared/project-media";
import type { MediaData } from "./types";
import { imageReference, mediaAlt, type MediaPreparation } from "../../shared/media-settings";

export function useMedia() {
  const [data, setData] = useState<MediaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const alt = mediaAlt(file?.name ?? "", "filename");
  const [preparation, setPreparation] = useState<MediaPreparation | null>(null);
  const [variant, setVariant] = useState<"original" | "processed" | "">("");
  const [uploaded, setUploaded] = useState<{
    reference: string;
    size: number;
    fileName: string;
    alt: string;
    publicReference: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState<ProjectImage | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const initialized = useRef(false);
  const generation = useRef(0);
  const readRequest = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    readRequest.current?.abort();
    const request = new AbortController();
    readRequest.current = request;
    setLoading(true);
    setError("");
    try {
      const next = await api<MediaData>("/api/media?view=project", { signal: request.signal });
      if (request.signal.aborted || readRequest.current !== request) return null;
      setData(next);
      if (!initialized.current) {
        initialized.current = true;
        setFolder(next.defaultFolder);
      }
      return next;
    } catch (cause) {
      if (!request.signal.aborted && readRequest.current === request)
        setError(errorMessage(cause, "媒体读取失败"));
      return null;
    } finally {
      if (!request.signal.aborted && readRequest.current === request) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
      readRequest.current?.abort();
    };
  }, [load]);
  const invalidate = () => {
    generation.current += 1;
    setPreparation(null);
    setVariant("");
    setError("");
  };
  const visibleItems = useMemo(
    () => data?.media.filter((item) => matchesProjectImage(item, query)) ?? [],
    [data, query],
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
    form.set("scope", "project");
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
      const result = await api<{
        reference: string;
        size: number;
        fileName: string;
        publicReference: boolean;
      }>("/api/media/commit", json("POST", { token: preparation.token, variant }));
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
  async function copy(reference: string, publicReference = true) {
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
        mediaAlt(decoded, "filename"),
        !publicReference || policy?.referenceFormat === "auto" || !policy
          ? "path"
          : policy.referenceFormat,
      );
      await navigator.clipboard.writeText(result);
      setNotice(`已复制：${result}`);
    } catch {
      setError("剪贴板不可用，请从上传结果中手动复制引用。");
    }
  }
  return {
    data,
    loading,
    query,
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
    setVariant,
    setQuery,
    setDeleting,
    setError,
    setNotice,
    setFolder: (value: string) => {
      invalidate();
      setFolder(value);
    },
    setFile: (value: File | null) => {
      invalidate();
      setFile(value);
      setUploaded(null);
      if (value && value.size > 20 * 1024 * 1024) setError("单张图片不能超过 20 MB。");
    },
    refresh: async () => {
      invalidate();
      await load();
    },
    resetDefaults: () => {
      invalidate();
      if (data) {
        setFolder(data.defaultFolder);
      }
    },
  };
}
