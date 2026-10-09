import type { EditorFontMode } from "../../lib/server/editor-fonts";
import { defaultPersonalSettings } from "../../shared/panel-settings";
import { useOptionalPersonalSettings } from "../settings/PersonalSettingsProvider";
import { editorFontFamilies } from "./editor-preferences";
import "./editor-fonts.css";

export function useArticleFonts(project: EditorFontMode) {
  const preferences = useOptionalPersonalSettings();
  const settings = preferences?.effective ?? defaultPersonalSettings;
  return editorFontFamilies(settings.editor, settings.appearance.font, project);
}
