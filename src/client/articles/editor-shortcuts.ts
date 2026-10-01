import type { KeyboardEvent } from "react";

export type EditorShortcut = "bold" | "italic" | "code" | "link" | "save";

export function articleShortcut(event: KeyboardEvent): EditorShortcut | null {
  if (
    event.nativeEvent.isComposing ||
    event.keyCode === 229 ||
    (!event.ctrlKey && !event.metaKey) ||
    event.altKey
  ) {
    return null;
  }

  const key = event.key.toLowerCase();
  if (key === "k" && event.shiftKey) {
    return "code";
  }
  if (event.shiftKey) {
    return null;
  }

  switch (key) {
    case "b":
      return "bold";
    case "i":
      return "italic";
    case "k":
      return "link";
    case "s":
      return "save";
    default:
      return null;
  }
}
