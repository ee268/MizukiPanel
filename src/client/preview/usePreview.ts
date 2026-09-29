import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, json } from "../api";
import { previewTargetUrl } from "../preview-log";
import { errorMessage } from "../shared/errors";
import type { PreviewStatus } from "../types";

export function usePreview() {
  const [params] = useSearchParams();
  const [preview, setPreview] = useState<PreviewStatus | null>(null);
  const [pagePath, setPagePath] = useState(
    params.get("path")?.startsWith("/") ? params.get("path")! : "/",
  );
  const [error, setError] = useState("");
  const pendingTab = useRef<Window | null>(null);

  const load = useCallback(async () => {
    try {
      setPreview(await api<PreviewStatus>("/api/preview/status"));
    } catch (cause) {
      setError(errorMessage(cause, "预览状态读取失败"));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 1500);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(
    () => () => {
      if (pendingTab.current && !pendingTab.current.closed) {
        pendingTab.current.close();
      }
    },
    [],
  );

  const active = preview?.state === "running" || preview?.state === "external";
  const targetUrl = useMemo(
    () => previewTargetUrl(preview?.url ?? "", pagePath),
    [pagePath, preview?.url],
  );

  useEffect(() => {
    const tab = pendingTab.current;
    if (!active || !targetUrl || !tab || tab.closed) {
      return;
    }

    tab.location.replace(targetUrl);
    pendingTab.current = null;
  }, [active, targetUrl]);

  function createPendingTab(): Window | null {
    if (pendingTab.current && !pendingTab.current.closed) {
      pendingTab.current.close();
    }

    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      return null;
    }

    tab.opener = null;
    tab.document.title = "正在启动 Mizuki";
    tab.document.body.textContent = "Mizuki 正在启动，服务就绪后将自动打开。";
    tab.document.body.style.cssText =
      'margin:0;min-height:100vh;display:grid;place-items:center;font:16px "Segoe UI",sans-serif;background:#111318;color:#e5e7eb';
    return tab;
  }

  async function start() {
    setError("");
    pendingTab.current = createPendingTab();
    try {
      setPreview(await api<PreviewStatus>("/api/preview/start", json("POST")));
    } catch (cause) {
      if (pendingTab.current && !pendingTab.current.closed) {
        pendingTab.current.close();
      }
      pendingTab.current = null;
      setError(errorMessage(cause, "启动失败"));
    }
  }

  async function stop() {
    setError("");
    if (pendingTab.current && !pendingTab.current.closed) {
      pendingTab.current.close();
    }
    pendingTab.current = null;

    try {
      setPreview(await api<PreviewStatus>("/api/preview/stop", json("POST")));
    } catch (cause) {
      setError(errorMessage(cause, "停止失败"));
    }
  }

  return {
    preview,
    pagePath,
    error,
    active,
    targetUrl,
    setPagePath,
    start,
    stop,
  };
}
