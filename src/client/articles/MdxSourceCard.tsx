import CodeOutlined from "@mui/icons-material/CodeOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import { Alert, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { sourceCardLabel, validateSourceCardEdit } from "../../lib/articles/mdx-source-edit";
import type { SegmentedArticle, SourceSegment } from "../../lib/articles/source-islands";

interface MdxSourceCardProps {
  article: SegmentedArticle;
  segment: SourceSegment;
  readOnly: boolean;
  onChange: (raw: string) => void;
  onValidityChange: (valid: boolean) => void;
}

export function MdxSourceCard({
  article,
  segment,
  readOnly,
  onChange,
  onValidityChange,
}: MdxSourceCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(segment.raw);
  const [reason, setReason] = useState<string | null>(null);

  function change(next: string) {
    setDraft(next);
    const result = validateSourceCardEdit(article, segment, next);
    setReason(result.reason);
    onValidityChange(result.reason === null);
    if (result.source !== null) {
      onChange(result.source);
    }
  }

  function cancel() {
    setDraft(segment.raw);
    setReason(null);
    setEditing(false);
    onValidityChange(true);
    onChange(segment.raw);
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
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <CodeOutlined />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {sourceCardLabel(segment)}
          </Typography>
          <Chip size="small" label="原文片段" />
          {!readOnly && (
            <Button
              size="small"
              startIcon={<EditOutlined />}
              onClick={() => setEditing((current) => !current)}
              disabled={editing && reason !== null}
              sx={{ ml: "auto" }}
            >
              {editing ? "完成" : "编辑片段源码"}
            </Button>
          )}
        </Stack>
        {editing && !readOnly ? (
          <>
            <TextField
              label="片段源码"
              value={draft}
              onChange={(event) => change(event.target.value)}
              error={reason !== null}
              multiline
              minRows={3}
              fullWidth
              slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: 14 } } }}
            />
            {reason && <Alert severity="warning">{reason}。修正前无法保存正文。</Alert>}
            <Button size="small" onClick={cancel} sx={{ alignSelf: "flex-start" }}>
              取消本片段修改
            </Button>
          </>
        ) : (
          <Typography
            component="pre"
            sx={{ m: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 13 }}
          >
            {draft}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
