import AccountTreeOutlined from "@mui/icons-material/AccountTreeOutlined";
import CodeOutlined from "@mui/icons-material/CodeOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
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
  const [language, setLanguage] = useState(block.lang);
  const [meta, setMeta] = useState(block.meta);
  const [body, setBody] = useState(block.body);
  const [editing, setEditing] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const editorRef = useRef<EditorView | null>(null);
  const diagram = language === "mermaid" || language === "plantuml";

  useEffect(() => {
    if (editing && !readOnly) editorRef.current?.focus();
  }, [editing, readOnly]);

  function change(next: { language?: string; meta?: string; body?: string }) {
    const nextLanguage = next.language ?? language;
    const nextMeta = next.meta ?? meta;
    const nextBody = next.body ?? body;
    const raw = updateFencedCode(block, {
      ...(nextLanguage !== block.lang ? { lang: nextLanguage } : {}),
      ...(nextMeta !== block.meta ? { meta: nextMeta } : {}),
      ...(nextBody !== block.body ? { body: nextBody } : {}),
    });
    setLanguage(nextLanguage);
    setMeta(nextMeta);
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
    setMeta(block.meta);
    setBody(block.body);
    onChange(block.raw);
  }

  if (removed) {
    return (
      <Paper className="mizuki-code-card" variant="outlined" sx={{ p: 2 }}>
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
      className="mizuki-code-card"
      variant="outlined"
      sx={{
        p: 2,
        borderLeft: "4px solid",
        borderLeftColor: "primary.main",
        backgroundColor: "action.hover",
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {diagram ? <AccountTreeOutlined /> : <CodeOutlined />}
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {diagram ? "图表源码" : "代码块"}
          </Typography>
          <Chip size="small" label={language || "text"} />
          {editing && !readOnly && (
            <Button
              color="error"
              size="small"
              startIcon={<DeleteOutline />}
              onClick={remove}
              sx={{ ml: "auto" }}
            >
              删除代码块
            </Button>
          )}
        </Stack>
        {editing && !readOnly && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Autocomplete
              freeSolo
              options={languageOptions}
              value={language || "text"}
              onChange={(_, value) => change({ language: value ?? "" })}
              onInputChange={(_, value, reason) => {
                if (reason === "input") change({ language: value });
              }}
              renderInput={(params) => <TextField {...params} label="语言" size="small" />}
              sx={{ minWidth: 180, flex: 1 }}
            />
            <TextField
              label="代码块参数"
              value={meta}
              onChange={(event) => change({ meta: event.target.value })}
              size="small"
              sx={{ flex: 2 }}
            />
          </Stack>
        )}
        <SyntaxCodeEditor
          label={editing ? "编辑代码内容" : "点击编辑代码块"}
          language={language}
          value={body}
          readOnly={readOnly || !editing}
          onClick={() => {
            if (!readOnly) setEditing(true);
          }}
          onChange={(value) => change({ body: value })}
          onReady={(view) => {
            editorRef.current = view;
            if (editing && !readOnly) view.focus();
          }}
        />
        {diagram && !editing && (
          <Typography variant="caption" color="text.secondary">
            点击代码可编辑；图形效果在单篇 Markdown 预览中显示。
          </Typography>
        )}
        {invalid && (
          <Alert severity="warning">围栏语法无效，请调整语言、参数或代码内容后保存。</Alert>
        )}
      </Stack>
    </Paper>
  );
}
