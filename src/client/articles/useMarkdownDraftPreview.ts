import { useEffect, useRef, useState } from "react";
import { splitArticleSource } from "../../lib/articles/article-source";
import { api, json } from "../api";
import type { MarkdownPreviewResult } from "./markdown-preview-document";

export type PreviewPhase = "waiting" | "rendering" | "ready" | "error" | "unsupported";

export interface DraftPreviewState {
  phase: PreviewPhase;
  result: MarkdownPreviewResult | null;
  error: string | null;
}

export function useMarkdownDraftPreview(
  articleId: string,
  format: "md" | "mdx",
  source: string,
): DraftPreviewState {
  const revision = useRef(0);
  const [state, setState] = useState<DraftPreviewState>({
    phase: format === "mdx" ? "unsupported" : "waiting",
    result: null,
    error: null,
  });

  useEffect(() => {
    const current = ++revision.current;
    if (format === "mdx") {
      setState({ phase: "unsupported", result: null, error: null });
      return;
    }
    const body = splitArticleSource(source)?.body;
    if (body === undefined) {
      setState((previous) => ({
        ...previous,
        phase: "error",
        error: "Frontmatter 边界无效，无法预览正文",
      }));
      return;
    }
    const controller = new AbortController();
    setState((previous) => ({ ...previous, phase: "waiting", error: null }));
    const timer = window.setTimeout(async () => {
      if (current !== revision.current) return;
      setState((previous) => ({ ...previous, phase: "rendering" }));
      try {
        const result = await api<MarkdownPreviewResult>("/api/article/render-draft", {
          ...json("POST", { id: articleId, body }),
          signal: controller.signal,
        });
        if (current === revision.current) {
          setState({ phase: "ready", result, error: null });
        }
      } catch (error) {
        if (current !== revision.current || controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          phase: "error",
          error: error instanceof Error ? error.message : "草稿预览失败",
        }));
      }
    }, 1000);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [articleId, format, source]);

  return state;
}
