import { html } from "@codemirror/lang-html";
import { languages } from "@codemirror/language-data";
import { Box, useTheme } from "@mui/material";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useEffect, useMemo, useState } from "react";

type LoadedLanguage = Awaited<ReturnType<(typeof languages)[number]["load"]>>;

interface SyntaxCodeEditorProps {
  label: string;
  language: string;
  value: string;
  readOnly: boolean;
  variant?: "outlined" | "embedded";
  onChange?: (value: string, selectionStart: number) => void;
  onClick?: () => void;
  onReady?: (view: EditorView) => void;
}

function languageDescription(name: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized || normalized === "text" || normalized === "plaintext") return null;
  return languages.find((item) =>
    [item.name, ...item.alias, ...item.extensions].some(
      (candidate) => candidate.toLowerCase() === normalized,
    ),
  );
}

export function SyntaxCodeEditor({
  label,
  language,
  value,
  readOnly,
  variant = "outlined",
  onChange,
  onClick,
  onReady,
}: SyntaxCodeEditorProps) {
  const theme = useTheme();
  const [loaded, setLoaded] = useState<LoadedLanguage | null>(null);
  const fontFamily =
    variant === "embedded"
      ? "MizukiEditorBody, MizukiEditorCjk, var(--mizuki-panel-font-sans)"
      : "var(--mizuki-panel-font-mono)";

  useEffect(() => {
    if (language.toLowerCase() === "html") {
      setLoaded(html());
      return;
    }
    const description = languageDescription(language);
    if (!description) {
      setLoaded(null);
      return;
    }
    let active = true;
    setLoaded(null);
    void description.load().then(
      (support) => {
        if (active) setLoaded(support);
      },
      () => {
        if (active) setLoaded(null);
      },
    );
    return () => {
      active = false;
    };
  }, [language]);

  const editorTheme = useMemo(
    () =>
      EditorView.theme(
        {
          "&": {
            backgroundColor: "transparent",
            color: theme.palette.text.primary,
            fontFamily,
            fontSize: variant === "embedded" ? "16px" : "14px",
          },
          ".cm-content": {
            caretColor: theme.palette.primary.main,
            fontFamily,
            lineHeight: "1.6",
            padding:
              variant === "embedded" ? (readOnly ? "8px 72px 8px 14px" : "8px 14px") : "10px 0",
          },
          ".cm-gutters": {
            backgroundColor: "transparent",
            borderRightColor: variant === "embedded" ? theme.palette.divider : "transparent",
            color: theme.palette.text.secondary,
            paddingLeft: variant === "embedded" ? "4px" : "0",
          },
          ".cm-activeLine, .cm-activeLineGutter": {
            backgroundColor: "color-mix(in srgb, var(--mui-palette-primary-main) 10%, transparent)",
          },
          ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
            backgroundColor: "color-mix(in srgb, var(--mui-palette-primary-main) 28%, transparent)",
          },
          ".cm-scroller": { overflow: "auto" },
        },
        { dark: theme.palette.mode === "dark" },
      ),
    [theme, variant, readOnly, fontFamily],
  );
  const extensions = useMemo(
    () => [EditorView.lineWrapping, editorTheme, ...(loaded ? [loaded] : [])],
    [editorTheme, loaded],
  );

  return (
    <Box
      onClick={onClick}
      sx={{
        border: variant === "embedded" ? 0 : "1px solid",
        borderColor: variant === "embedded" ? "transparent" : "divider",
        borderRadius: variant === "embedded" ? 0 : 1,
        overflow: "hidden",
        fontFamily,
        "&:focus-within": {
          borderColor:
            variant === "embedded" ? "transparent" : readOnly ? "divider" : "primary.main",
        },
        ...(variant === "embedded"
          ? {
              "& .cm-editor, & .cm-scroller, & .cm-gutters": {
                backgroundColor: "transparent !important",
              },
            }
          : {}),
      }}
    >
      <CodeMirror
        aria-label={label}
        basicSetup={{
          autocompletion: !readOnly,
          bracketMatching: true,
          closeBrackets: !readOnly,
          foldGutter: false,
          highlightActiveLine: !readOnly,
          highlightActiveLineGutter: !readOnly,
          lineNumbers: true,
        }}
        editable={!readOnly}
        extensions={extensions}
        indentWithTab={!readOnly}
        onChange={(next, update) => onChange?.(next, update.state.selection.main.head)}
        onCreateEditor={onReady}
        readOnly={readOnly}
        theme={theme.palette.mode}
        value={value}
      />
    </Box>
  );
}
