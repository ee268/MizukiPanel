import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import { Box, Button, Stack, TextField } from "@mui/material";
import type { RefObject } from "react";

interface ArticleSourceEditorProps {
  source: string;
  busy: boolean;
  readOnly: boolean;
  canUseVisual: boolean;
  contentRef: RefObject<HTMLDivElement | null>;
  onChange: (source: string) => void;
  onVisualMode: () => void;
  onSave: () => void;
}

export function ArticleSourceEditor({
  source,
  busy,
  readOnly,
  canUseVisual,
  contentRef,
  onChange,
  onVisualMode,
  onSave,
}: ArticleSourceEditorProps) {
  return (
    <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          position: "sticky",
          top: { xs: 56, sm: 64 },
          zIndex: 2,
          backgroundColor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          p: 1,
        }}
      >
        <Button
          size="small"
          startIcon={<ArrowBackOutlined />}
          onClick={onVisualMode}
          disabled={!canUseVisual}
        >
          返回可视化正文
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={<SaveOutlined />}
          onClick={onSave}
          disabled={busy || readOnly}
        >
          保存源码
        </Button>
      </Stack>
      <Box ref={contentRef}>
        <TextField
          label="完整文章源码"
          value={source}
          onChange={(event) => onChange(event.target.value)}
          fullWidth
          multiline
          minRows={24}
          disabled={busy || readOnly}
          spellCheck={false}
          slotProps={{
            input: { sx: { fontFamily: "monospace", fontSize: 14, lineHeight: 1.6 } },
          }}
        />
      </Box>
    </Stack>
  );
}
