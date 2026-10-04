import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import type { EditorView } from "@uiw/react-codemirror";
import { useEffect, useRef, useState } from "react";
import { updateFencedCode, type FencedCode } from "../../lib/articles/fenced-code";
import { SyntaxCodeEditor } from "./SyntaxCodeEditor";

interface CodeBlockCardProps {
  block: FencedCode;
  readOnly: boolean;
  onChange: (raw: string) => void;
  onValidityChange: (valid: boolean) => void;
}

const languageOptions = [
  "text",
  "bash",
  "c",
  "cpp",
  "css",
  "go",
  "html",
  "java",
  "javascript",
  "json",
  "mermaid",
  "plantuml",
  "python",
  "rust",
  "sql",
  "typescript",
  "yaml",
];

export function CodeBlockCard({ block, readOnly, onChange, onValidityChange }: CodeBlockCardProps) {
  const theme = useTheme();
  const [language, setLanguage] = useState(block.lang);
  const [body, setBody] = useState(block.body);
  const [editing, setEditing] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const editorRef = useRef<EditorView | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && !readOnly) editorRef.current?.focus();
  }, [editing, readOnly]);

  useEffect(() => {
    if (!editing) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setEditing(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside, true);
    return () => document.removeEventListener("pointerdown", closeOutside, true);
  }, [editing]);

  function change(next: { language?: string; body?: string }) {
    const nextLanguage = next.language ?? language;
    const nextBody = next.body ?? body;
    const raw = updateFencedCode(block, {
      ...(nextLanguage !== block.lang ? { lang: nextLanguage } : {}),
      ...(nextBody !== block.body ? { body: nextBody } : {}),
    });
    setLanguage(nextLanguage);
    setBody(nextBody);
    setInvalid(raw === null);
    onValidityChange(raw !== null);
    if (raw !== null) onChange(raw);
  }

  function remove() {
    setRemoved(true);
    setEditing(false);
    setInvalid(false);
    onValidityChange(true);
    onChange("");
  }

  function restore() {
    setRemoved(false);
    setLanguage(block.lang);
    setBody(block.body);
    onChange(block.raw);
  }

  if (removed) {
    return (
      <Paper className="mizuki-code-card" variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Typography color="text.secondary">代码块已删除，保存正文后生效。</Typography>
          <Button disabled={readOnly} onClick={restore}>
            撤销删除
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      ref={containerRef}
      className="mizuki-code-card"
      variant="outlined"
      onClick={() => {
        if (!readOnly && !editing) setEditing(true);
      }}
      sx={{
        position: "relative",
        py: editing ? 2 : 1.5,
        px: 2,
        border: 0,
        borderRadius: "0.375rem",
        backgroundColor: theme.palette.mode === "dark" ? "#0b110e" : "#e5e9ed",
        boxShadow: "none",
        cursor: readOnly ? "default" : editing ? "auto" : "text",
      }}
    >
      <Stack spacing={1.5}>
        {!editing && (
          <Box
            component="span"
            sx={{
              position: "absolute",
              top: 8,
              right: 10,
              zIndex: 1,
              px: 1,
              py: 0.4,
              borderRadius: "0.375rem",
              backgroundColor: `color-mix(in srgb, ${theme.palette.primary.main} 25%, transparent)`,
              color: "primary.main",
              fontFamily: "var(--mizuki-panel-font-mono)",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.2,
              textTransform: "uppercase",
              pointerEvents: "none",
            }}
          >
            {language || "TEXT"}
          </Box>
        )}
        {editing && !readOnly && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ alignItems: { sm: "center" }, justifyContent: "flex-end" }}
          >
            <Autocomplete
              disablePortal
              freeSolo
              options={languageOptions}
              value={language || "text"}
              onChange={(_, value) => change({ language: value ?? "" })}
              onInputChange={(_, value, reason) => {
                if (reason === "input") change({ language: value });
              }}
              renderInput={(params) => <TextField {...params} label="语言" size="small" />}
              sx={{ width: { xs: "100%", sm: 180 }, flex: "none" }}
            />
            <Button
              color="error"
              size="small"
              startIcon={<DeleteOutline />}
              onClick={remove}
              sx={{ whiteSpace: "nowrap" }}
            >
              删除
            </Button>
          </Stack>
        )}
        <SyntaxCodeEditor
          label={editing ? "编辑代码内容" : "点击编辑代码块"}
          language={language}
          value={body}
          readOnly={readOnly || !editing}
          variant="embedded"
          onChange={(value) => change({ body: value })}
          onReady={(view) => {
            editorRef.current = view;
            if (editing && !readOnly) view.focus();
          }}
        />
        {invalid && <Alert severity="warning">围栏语法无效，请调整语言或代码内容后保存。</Alert>}
      </Stack>
    </Paper>
  );
}
