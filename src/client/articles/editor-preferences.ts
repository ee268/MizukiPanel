import type { AppearanceSettings, EditorSettings } from "../../shared/panel-settings";
import type { EditorFontMode } from "../../lib/server/editor-fonts";
import { panelFontFamilies } from "../font-families";

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

export function editorFontFamilies(
  settings: Pick<EditorSettings, "bodyFont" | "codeFont">,
  appearance: AppearanceSettings["font"],
  project: EditorFontMode,
) {
  const bodyMode = editorBodyFont(settings.bodyFont, appearance, project);
  const codeMode = editorBodyFont(settings.codeFont, appearance, project);
  const body = `MizukiSourceDelimiters, ${panelFontFamilies[bodyMode].body}`;
  const code =
    codeMode === "custom"
      ? `MizukiEditorCode, ${panelFontFamilies[bodyMode].body}, monospace`
      : panelFontFamilies[codeMode].code;
  return { bodyMode, codeMode, body, code };
}
