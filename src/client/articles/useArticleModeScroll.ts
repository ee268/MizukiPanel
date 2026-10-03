import { useLayoutEffect, useRef } from "react";
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
              : Math.min(1, (position - top) / Math.max(1, current.offsetHeight)),
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

      if (ratio === null) {
        window.scrollTo(0, pageY);
        return;
      }

      const top = target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + ratio * target.offsetHeight - offset);
    }

    let settleTimer: number;
    const frame = requestAnimationFrame(() => {
      restore();
      const restoredY = window.scrollY;
      settleTimer = window.setTimeout(() => {
        if (Math.abs(window.scrollY - restoredY) < 4) {
          restore();
        }
        pending.current = null;
      }, 200);
    });

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, [mode]);

  return { visualRef, sourceRef, changeMode };
}
