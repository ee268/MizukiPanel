import { useEffect, useState } from "react";
import { api } from "../api";
import type { EditorFontMode } from "../../shared/editor-fonts";

export function useEditorFontMode(projectRoot: string): EditorFontMode {
  const [mode, setMode] = useState<EditorFontMode>("system");

  useEffect(() => {
    let active = true;
    setMode("system");
    api<{ mode: EditorFontMode }>("/api/editor-fonts")
      .then((result) => {
        if (active) setMode(result.mode);
      })
      .catch(() => {
        if (active) setMode("system");
      });
    return () => {
      active = false;
    };
  }, [projectRoot]);

  return mode;
}
