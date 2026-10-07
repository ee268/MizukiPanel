import { splitArticleSource } from "../../lib/articles/article-source";
import { toTextareaOffset } from "./source-textarea";

export interface VisualAnchor {
  sourceOffset: number;
  pageY: number;
}

export interface SourceMeasure {
  pageYAt: (sourceOffset: number) => number;
  dispose: () => void;
}

function pageY(element: HTMLElement) {
  return element.getBoundingClientRect().top + window.scrollY;
}

function matchingOffset(source: string, element: Element, start: number) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (!text || text.length < 8) continue;

    for (const length of [48, 24, 12, 8]) {
      if (text.length < length) continue;
      const found = source.indexOf(text.slice(0, length), start);
      if (found >= 0) return { offset: found, length };
    }
  }
  return null;
}

/** Match rendered blocks to their text in the current, possibly unsaved source. */
export function collectVisualAnchors(root: HTMLElement, source: string): VisualAnchor[] | null {
  const content = root.querySelector<HTMLElement>(".mizuki-document-content");
  const segments = content?.querySelectorAll<HTMLElement>("[data-article-segment]");
  if (!content || !segments?.length) return null;

  const normalized = source.replace(/\r\n?/g, "\n");
  const bodyStart = toTextareaOffset(source, splitArticleSource(source)?.bodyStart ?? 0);
  const anchors: VisualAnchor[] = [{ sourceOffset: bodyStart, pageY: pageY(content) }];
  let cursor = bodyStart;

  for (const segment of segments) {
    if (segment.dataset.articleSegment === "editable") {
      const editor = segment.querySelector<HTMLElement>(".milkdown .editor");
      if (!editor) return null;

      for (const block of editor.children) {
        const match = matchingOffset(normalized, block, cursor);
        if (!match) continue;
        anchors.push({ sourceOffset: match.offset, pageY: pageY(block as HTMLElement) });
        cursor = match.offset + match.length;
      }
    } else {
      const exact = segment.dataset.sourceMatch;
      const found = exact ? normalized.indexOf(exact.replace(/\r\n?/g, "\n"), cursor) : -1;
      const offset =
        found >= 0 ? found : toTextareaOffset(source, Number(segment.dataset.sourceStart ?? 0));
      anchors.push({ sourceOffset: offset, pageY: pageY(segment) });
      cursor = Math.max(cursor, offset + (exact?.length ?? 1));
    }
  }

  anchors.push({ sourceOffset: normalized.length, pageY: pageY(content) + content.offsetHeight });
  const ordered = [anchors[0]];
  for (const anchor of anchors.slice(1)) {
    const previous = ordered[ordered.length - 1];
    if (anchor.sourceOffset === previous.sourceOffset && anchor.pageY > previous.pageY) {
      ordered[ordered.length - 1] = anchor;
    } else if (anchor.sourceOffset > previous.sourceOffset && anchor.pageY > previous.pageY) {
      ordered.push(anchor);
    }
  }
  return ordered;
}

/** A hidden copy of the textarea supplies the browser's actual wrapped line positions. */
export function createSourceMeasure(textarea: HTMLTextAreaElement): SourceMeasure {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement("div");
  Object.assign(mirror.style, {
    position: "fixed",
    top: "0",
    left: "-100000px",
    visibility: "hidden",
    pointerEvents: "none",
    boxSizing: "border-box",
    width: `${textarea.clientWidth}px`,
    padding: style.padding,
    border: "0",
    font: style.font,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    whiteSpace: "pre-wrap",
    overflowWrap: style.overflowWrap,
    wordBreak: style.wordBreak,
    tabSize: style.tabSize,
  });
  const value = textarea.value;
  const text = document.createTextNode(value || " ");
  mirror.append(text);
  document.body.append(mirror);
  const range = document.createRange();
  const top = pageY(textarea) - textarea.scrollTop;
  let disposed = false;

  return {
    pageYAt(sourceOffset) {
      if (sourceOffset >= value.length) return top + mirror.offsetHeight;
      let offset = Math.max(0, sourceOffset);
      while (value[offset] === "\n" && offset < value.length - 1) offset++;
      range.setStart(text, offset);
      range.setEnd(text, offset + 1);
      return top + range.getBoundingClientRect().top - mirror.getBoundingClientRect().top;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mirror.remove();
    },
  };
}

function interpolate(
  value: number,
  before: number,
  after: number,
  targetBefore: number,
  targetAfter: number,
) {
  const fraction = Math.min(1, Math.max(0, (value - before) / Math.max(1, after - before)));
  return targetBefore + fraction * (targetAfter - targetBefore);
}

export function visualYForSourceY(
  anchors: VisualAnchor[],
  measure: SourceMeasure,
  sourceY: number,
) {
  for (let index = 1; index < anchors.length; index++) {
    const after = anchors[index];
    const afterY = measure.pageYAt(after.sourceOffset);
    if (sourceY <= afterY || index === anchors.length - 1) {
      const before = anchors[index - 1];
      return interpolate(
        sourceY,
        measure.pageYAt(before.sourceOffset),
        afterY,
        before.pageY,
        after.pageY,
      );
    }
  }
  return null;
}

export function sourceYForVisualY(
  anchors: VisualAnchor[],
  measure: SourceMeasure,
  visualY: number,
) {
  for (let index = 1; index < anchors.length; index++) {
    const after = anchors[index];
    if (visualY <= after.pageY || index === anchors.length - 1) {
      const before = anchors[index - 1];
      return interpolate(
        visualY,
        before.pageY,
        after.pageY,
        measure.pageYAt(before.sourceOffset),
        measure.pageYAt(after.sourceOffset),
      );
    }
  }
  return null;
}
