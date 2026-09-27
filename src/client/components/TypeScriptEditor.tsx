import { useMemo } from "react";
import { Box, useTheme } from "@mui/material";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";

export function TypeScriptEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  const editorTheme = useMemo(
    () =>
      EditorView.theme(
        {
          "&": {
            backgroundColor: theme.palette.background.default,
            color: theme.palette.text.primary,
            fontSize: "13px",
          },
          ".cm-content": {
            caretColor: theme.palette.primary.main,
            fontFamily: 'Consolas, "Cascadia Code", monospace',
            lineHeight: "1.55",
            padding: "12px 0",
          },
          ".cm-cursor, .cm-dropCursor": {
            borderLeftColor: theme.palette.primary.main,
          },
          ".cm-gutters": {
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
          ".cm-scroller": { overflow: "auto" },
        },
        { dark: theme.palette.mode === "dark" },
      ),
    [theme],
  );
  const extensions = useMemo(
    () => [javascript({ typescript: true }), EditorView.lineWrapping, editorTheme],
    [editorTheme],
  );

  return (
    <Box
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
        "& .cm-editor": { minHeight: 520 },
      }}
    >
      <CodeMirror
        aria-label="TypeScript 配置编辑器"
        basicSetup={{
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          lineNumbers: true,
        }}
        editable={!disabled}
        extensions={extensions}
        height="520px"
        indentWithTab
        onChange={onChange}
        readOnly={disabled}
        theme={theme.palette.mode}
        value={value}
      />
    </Box>
  );
}
