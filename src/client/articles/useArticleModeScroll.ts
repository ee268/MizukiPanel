import { useLayoutEffect, useRef } from "react";
import { articleScrollProgress, articleScrollTargetY } from "./article-scroll-position";
import type { ArticleEditorMode } from "./types";

type BodyMode = Extract<ArticleEditorMode, "visual" | "source">;

interface ScrollPosition {
  target: BodyMode;
  ratio: number | null;
  pageY: number;
  viewportOffset: number;
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
) {
  const visualRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const pending = useRef<ScrollPosition | null>(null);

  function changeMode(next: ArticleEditorMode) {
    if (next === mode) {
      return;
    }

    pending.current = null;
    if (isBodyMode(mode) && isBodyMode(next)) {
      const current = mode === "visual" ? visualRef.current : sourceRef.current;
      if (current) {
        const offset = viewportOffset();
        const pageY = window.scrollY;
        const top = current.getBoundingClientRect().top + pageY;
        const position = pageY + offset;

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
    const { ratio, pageY, viewportOffset: offset } = position;

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

      const top = target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: articleScrollTargetY(ratio, top, target.offsetHeight, window.innerHeight, offset),
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
        for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
          window.removeEventListener(type, stopRestoring, { capture: true });
        }
      }
    };
    const target = mode === "visual" ? visualRef.current : sourceRef.current;
    const observer = new ResizeObserver(scheduleRestore);
    restore();
    if (target) {
      observer.observe(target);
    }
    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
      window.addEventListener(type, stopRestoring, { capture: true });
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
        window.removeEventListener(type, stopRestoring, { capture: true });
      }
    };
  }, [mode]);

  return { visualRef, sourceRef, changeMode };
}
