import { useLayoutEffect, useRef } from "react";
import {
  collectVisualAnchors,
  createSourceMeasure,
  sourceYForVisualY,
  visualYForSourceY,
  type SourceMeasure,
  type VisualAnchor,
} from "./article-scroll-anchors";
import { articleScrollProgress, articleScrollTargetY } from "./article-scroll-position";
import type { ArticleEditorMode } from "./types";

type BodyMode = Extract<ArticleEditorMode, "visual" | "source">;

interface ScrollPosition {
  target: BodyMode;
  ratio: number | null;
  pageY: number;
  viewportOffset: number;
  readingAnchor?:
    | { mode: "source"; pageY: number; measure: SourceMeasure }
    | { mode: "visual"; pageY: number; anchors: VisualAnchor[] };
  targetMeasure?: SourceMeasure;
}

function isBodyMode(mode: ArticleEditorMode): mode is BodyMode {
  return mode === "visual" || mode === "source";
}

function viewportOffset() {
  return Math.min(180, Math.max(96, window.innerHeight * 0.2));
}

export function useArticleModeScroll(
  mode: ArticleEditorMode,
  onModeChange: (mode: ArticleEditorMode) => void,
  source: string,
) {
  const visualRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const pending = useRef<ScrollPosition | null>(null);

  function changeMode(next: ArticleEditorMode) {
    if (next === mode) {
      return;
    }

    pending.current?.targetMeasure?.dispose();
    if (pending.current?.readingAnchor?.mode === "source") {
      pending.current.readingAnchor.measure.dispose();
    }
    pending.current = null;
    if (isBodyMode(mode) && isBodyMode(next)) {
      const current = mode === "visual" ? visualRef.current : sourceRef.current;
      if (current) {
        const offset = viewportOffset();
        const pageY = window.scrollY;
        const top = current.getBoundingClientRect().top + pageY;
        const position = pageY + offset;

        const textarea = current.querySelector<HTMLTextAreaElement>(
          'textarea:not([aria-hidden="true"])',
        );
        const anchors = mode === "visual" ? collectVisualAnchors(current, source) : null;
        const readingAnchor =
          mode === "source" && textarea
            ? { mode: "source" as const, pageY: position, measure: createSourceMeasure(textarea) }
            : anchors && anchors.length > 2
              ? { mode: "visual" as const, pageY: position, anchors }
              : undefined;

        pending.current = {
          target: next,
          ratio:
            position < top
              ? null
              : articleScrollProgress(
                  position,
                  top,
                  current.offsetHeight,
                  window.innerHeight,
                  offset,
                ),
          pageY,
          viewportOffset: offset,
          readingAnchor,
        };
      }
    }

    onModeChange(next);
  }

  useLayoutEffect(() => {
    const position = pending.current;
    if (!position || position.target !== mode) {
      return;
    }
    const saved = position;
    const { ratio, pageY, viewportOffset: offset, readingAnchor } = position;

    function restore() {
      const target = mode === "visual" ? visualRef.current : sourceRef.current;
      if (!target) {
        return;
      }

      if (mode === "visual" && !target.querySelector(".mizuki-document-content")) {
        window.scrollTo({ top: pageY, behavior: "instant" });
        return;
      }

      if (ratio === null) {
        window.scrollTo({ top: pageY, behavior: "instant" });
        return;
      }

      let semanticY: number | null = null;
      if (mode === "visual" && readingAnchor?.mode === "source") {
        const anchors = collectVisualAnchors(target, source);
        if (anchors && anchors.length > 2) {
          semanticY = visualYForSourceY(anchors, readingAnchor.measure, readingAnchor.pageY);
        }
      } else if (mode === "source" && readingAnchor?.mode === "visual") {
        const textarea = target.querySelector<HTMLTextAreaElement>(
          'textarea:not([aria-hidden="true"])',
        );
        if (textarea) {
          saved.targetMeasure ??= createSourceMeasure(textarea);
          semanticY = sourceYForVisualY(
            readingAnchor.anchors,
            saved.targetMeasure,
            readingAnchor.pageY,
          );
        }
      }

      const top = target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top:
          semanticY === null
            ? articleScrollTargetY(ratio, top, target.offsetHeight, window.innerHeight, offset)
            : semanticY - offset,
        behavior: "instant",
      });
    }

    let frame = 0;
    const scheduleRestore = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(restore);
    };
    const stopRestoring = (event: Event) => {
      if (event.isTrusted) {
        pending.current = null;
        cancelAnimationFrame(frame);
        observer.disconnect();
        mutation.disconnect();
        position.targetMeasure?.dispose();
        if (readingAnchor?.mode === "source") readingAnchor.measure.dispose();
        for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
          window.removeEventListener(type, stopRestoring, { capture: true });
        }
      }
    };
    const target = mode === "visual" ? visualRef.current : sourceRef.current;
    const observer = new ResizeObserver(scheduleRestore);
    const mutation = new MutationObserver(scheduleRestore);
    restore();
    if (target) {
      observer.observe(target);
      if (mode === "visual") {
        mutation.observe(target, { childList: true, subtree: true });
      }
    }
    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
      window.addEventListener(type, stopRestoring, { capture: true });
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutation.disconnect();
      position.targetMeasure?.dispose();
      if (readingAnchor?.mode === "source") readingAnchor.measure.dispose();
      for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
        window.removeEventListener(type, stopRestoring, { capture: true });
      }
    };
  }, [mode]);

  return { visualRef, sourceRef, changeMode };
}
