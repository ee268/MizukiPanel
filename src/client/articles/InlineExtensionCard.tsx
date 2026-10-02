import LinkOutlined from "@mui/icons-material/LinkOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import { Alert, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { updateInlineExtension, type InlineExtension } from "../../lib/articles/inline-extensions";

interface InlineExtensionCardProps {
  extension: InlineExtension;
  readOnly: boolean;
  onChange: (raw: string) => void;
  onValidityChange: (valid: boolean) => void;
}

export function InlineExtensionCard({
  extension,
  readOnly,
  onChange,
  onValidityChange,
}: InlineExtensionCardProps) {
  const [target, setTarget] = useState(extension.kind === "wiki" ? extension.target : "");
  const [label, setLabel] = useState(extension.kind === "wiki" ? extension.label : "");
  const [content, setContent] = useState(extension.kind === "spoiler" ? extension.content : "");
  const [invalid, setInvalid] = useState(false);

  function change(values: { target?: string; label?: string; content?: string }) {
    const next = updateInlineExtension(extension, {
      target: values.target ?? target,
      label: values.label ?? label,
      content: values.content ?? content,
    });
    if (values.target !== undefined) setTarget(values.target);
    if (values.label !== undefined) setLabel(values.label);
    if (values.content !== undefined) setContent(values.content);
    setInvalid(next === null);
    onValidityChange(next !== null);
    if (next !== null) onChange(next);
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
          {extension.kind === "wiki" ? <LinkOutlined /> : <VisibilityOffOutlined />}
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {extension.kind === "wiki" ? "Wiki Link" : "Spoiler"}
          </Typography>
          <Chip size="small" label={extension.kind === "wiki" ? "[[...]]" : ":spoiler[...]"} />
        </Stack>
        {extension.kind === "wiki" ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              label="目标文章路径或 #章节"
              value={target}
              onChange={(event) => change({ target: event.target.value })}
              disabled={readOnly}
              error={invalid}
              size="small"
              fullWidth
            />
            <TextField
              label="显示文字（可选）"
              value={label}
              onChange={(event) => change({ label: event.target.value })}
              disabled={readOnly}
              size="small"
              fullWidth
            />
          </Stack>
        ) : (
          <TextField
            label="遮罩文字或 Markdown"
            value={content}
            onChange={(event) => change({ content: event.target.value })}
            disabled={readOnly}
            error={invalid}
            size="small"
            fullWidth
          />
        )}
        {invalid && <Alert severity="warning">语法暂不完整；修正前无法保存正文。</Alert>}
      </Stack>
    </Paper>
  );
}
