import AccountTreeOutlined from "@mui/icons-material/AccountTreeOutlined";
import CodeOutlined from "@mui/icons-material/CodeOutlined";
import { Alert, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { updateFencedCode, type FencedCode } from "../../lib/articles/fenced-code";

interface CodeBlockCardProps {
  block: FencedCode;
  readOnly: boolean;
  onChange: (raw: string) => void;
  onValidityChange: (valid: boolean) => void;
}

export function CodeBlockCard({ block, readOnly, onChange, onValidityChange }: CodeBlockCardProps) {
  const [meta, setMeta] = useState(block.meta);
  const [body, setBody] = useState(block.body);
  const [invalid, setInvalid] = useState(false);
  const diagram = block.lang === "mermaid" || block.lang === "plantuml";

  function change(next: { meta?: string; body?: string }) {
    const nextMeta = next.meta ?? meta;
    const nextBody = next.body ?? body;
    const invalidStructure = (!diagram && !nextMeta.trim()) || (diagram && !nextBody.trim());
    const raw = invalidStructure
      ? null
      : updateFencedCode(block, {
          ...(nextMeta !== block.meta ? { meta: nextMeta } : {}),
          ...(nextBody !== block.body ? { body: nextBody } : {}),
        });
    if (next.meta !== undefined) setMeta(next.meta);
    if (next.body !== undefined) setBody(next.body);
    setInvalid(raw === null);
    onValidityChange(raw !== null);
    if (raw !== null) onChange(raw);
  }

  return (
    <Paper
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
            {diagram
              ? `${block.lang === "mermaid" ? "Mermaid" : "PlantUML"} 图表`
              : "Expressive Code"}
          </Typography>
          <Chip size="small" label={block.lang || "text"} />
        </Stack>
        {(!diagram || meta) && (
          <TextField
            label="代码块参数"
            value={meta}
            onChange={(event) => change({ meta: event.target.value })}
            disabled={readOnly}
            size="small"
            fullWidth
            helperText="例如 title=demo.js、showLineNumbers、行标记；其他参数按原文保留。"
          />
        )}
        <TextField
          label={diagram ? "图表源码" : "代码内容"}
          value={body}
          onChange={(event) => change({ body: event.target.value })}
          disabled={readOnly}
          multiline
          minRows={4}
          fullWidth
          slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: 14 } } }}
        />
        {diagram && (
          <Typography variant="caption" color="text.secondary">
            当前卡片编辑源码；图形效果在后续的单篇 Markdown 预览中显示。
          </Typography>
        )}
        {invalid && (
          <Alert severity="warning">
            围栏语法无效，或移除参数后代码块会变成普通正文；修正前无法保存正文。
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
