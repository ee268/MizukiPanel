import { useMemo, type Ref } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { syntaxLanguages, type SyntaxLanguage } from "./syntax-languages";

interface SyntaxEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  language: SyntaxLanguage;
  label?: string;
  ariaLabel?: string;
  height?: string;
  minHeight?: string;
  maxHeight?: string;
  editorRef?: Ref<ReactCodeMirrorRef>;
  initialCursorAtEnd?: boolean;
}

export function SyntaxEditor({
  value,
  onChange,
  disabled,
  language,
  label,
  ariaLabel = label ?? "代码编辑器",
  height = "auto",
  minHeight = "140px",
  maxHeight = "280px",
  editorRef,
  initialCursorAtEnd = false,
}: SyntaxEditorProps) {
  const theme = useTheme();
  const editorTheme = useMemo(
    () =>
      EditorView.theme(
        {
          "&": {
            backgroundColor: theme.palette.background.default,
            color: theme.palette.text.primary,
            fontFamily: "var(--mizuki-panel-font-mono)",
            fontSize: "13px",
          },
          ".cm-content": {
            caretColor: theme.palette.primary.main,
            fontFamily: "var(--mizuki-panel-font-mono)",
            lineHeight: "1.55",
            padding: "12px 0",
          },
          ".cm-cursor, .cm-dropCursor": { borderLeftColor: theme.palette.primary.main },
          ".cm-gutters": {
            fontFamily: "var(--mizuki-panel-font-mono)",
            backgroundColor: theme.palette.background.paper,
            borderRightColor: theme.palette.divider,
            color: theme.palette.text.secondary,
          },
          ".cm-activeLine, .cm-activeLineGutter": {
            backgroundColor: "color-mix(in srgb, var(--mui-palette-primary-main) 10%, transparent)",
          },
          ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
            backgroundColor: "color-mix(in srgb, var(--mui-palette-primary-main) 28%, transparent)",
          },
          ".cm-scroller": { overflow: "auto", fontFamily: "var(--mizuki-panel-font-mono)" },
        },
        { dark: theme.palette.mode === "dark" },
      ),
    [theme],
  );
  const extensions = useMemo(
    () => [
      syntaxLanguages[language],
      EditorView.lineWrapping,
      editorTheme,
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        "aria-multiline": "true",
        "aria-readonly": String(disabled),
      }),
    ],
    [language, editorTheme, ariaLabel, disabled],
  );
  return (
    <Box sx={{ minWidth: 0 }}>
      {label && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {label}
        </Typography>
      )}
      <Box
        data-syntax-language={language}
        sx={{
          border: "1px solid",
          borderColor: disabled ? "action.disabled" : "divider",
          borderRadius: 1,
          overflow: "hidden",
          transition: (current) => current.transitions.create("border-color"),
          "&:focus-within": {
            borderColor: "primary.main",
            boxShadow: "0 0 0 1px var(--mui-palette-primary-main)",
          },
        }}
      >
        <CodeMirror
          ref={editorRef}
          selection={initialCursorAtEnd ? { anchor: value.length } : undefined}
          value={value}
          onChange={onChange}
          theme={theme.palette.mode}
          extensions={extensions}
          editable={!disabled}
          readOnly={disabled}
          height={height}
          minHeight={minHeight}
          maxHeight={maxHeight}
          indentWithTab
          basicSetup={{
            autocompletion: true,
            bracketMatching: true,
            closeBrackets: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            lineNumbers: true,
          }}
        />
      </Box>
    </Box>
  );
}
