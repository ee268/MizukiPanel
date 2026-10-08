import type { KeyboardEvent } from "react";

/** Formatting and history shortcuts are handled by Vditor itself. */
export function articleShortcut(event: KeyboardEvent): "save" | null {
  if (
    event.nativeEvent.isComposing ||
    event.keyCode === 229 ||
    (!event.ctrlKey && !event.metaKey) ||
    event.altKey ||
    event.shiftKey
  )
    return null;
  return event.key.toLowerCase() === "s" ? "save" : null;
}
