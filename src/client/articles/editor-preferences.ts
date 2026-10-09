import type { AppearanceSettings, EditorSettings } from "../../shared/panel-settings";
import type { EditorFontMode } from "../../lib/server/editor-fonts";

export function defaultEditorMode(
  format: "md" | "mdx",
  mode: EditorSettings["defaultMode"],
  autoMode?: "ir" | "sv",
) {
  return mode === "auto" ? (autoMode ?? (format === "mdx" ? "sv" : "ir")) : mode;
}

export function editorBodyFont(
  font: EditorSettings["bodyFont"],
  appearance: AppearanceSettings["font"],
  project: EditorFontMode,
): "system" | "panel" | "custom" {
  if (font !== "project") return font;
  return appearance === "system" ? "system" : project;
}

export function editorCodeSize(settings: EditorSettings): string {
  return settings.codeFontSize === "relative"
    ? `${settings.bodyFontSize * 0.85}px`
    : `${settings.codeFontSize}px`;
}
