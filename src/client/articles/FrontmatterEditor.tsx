import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { createFrontmatterRow, type FrontmatterRow } from "./types";
import type { EditorFontMode } from "../../shared/editor-fonts";
import { useArticleFonts } from "./useArticleFonts";

interface FrontmatterEditorProps {
  rows: FrontmatterRow[];
  busy: boolean;
  readOnly: boolean;
  onChange: (rows: FrontmatterRow[]) => void;
  onSave: () => void;
  fontMode: EditorFontMode;
}

export function FrontmatterEditor({
  rows,
  busy,
  readOnly,
  onChange,
  onSave,
  fontMode,
}: FrontmatterEditorProps) {
  const fonts = useArticleFonts(fontMode);
  function update(rowId: string, field: "key" | "value", value: string) {
    onChange(rows.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row)));
  }

  function remove(rowId: string) {
    onChange(rows.filter((row) => row.rowId !== rowId));
  }

  function add() {
    onChange([...rows, createFrontmatterRow({ key: "", value: "" })]);
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" sx={{ px: 1, pb: 1, display: { xs: "none", sm: "flex" } }}>
        <Typography variant="caption" color="text.secondary" sx={{ width: "32%" }}>
          字段名
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          字段内容（YAML）
        </Typography>
      </Stack>
      <Stack spacing={1.5}>
        {rows.map((entry) => (
          <Stack key={entry.rowId} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <TextField
              aria-label="Frontmatter 字段名"
              disabled={busy || readOnly}
              value={entry.key}
              onChange={(event) => update(entry.rowId, "key", event.target.value)}
              placeholder="字段名"
              sx={{ width: { xs: "38%", sm: "32%" } }}
            />
            <TextField
              aria-label={`${entry.key || "未命名"} 字段内容`}
              disabled={busy || readOnly}
              value={entry.value}
              slotProps={{ input: { sx: { fontFamily: fonts.code } } }}
              onChange={(event) => update(entry.rowId, "value", event.target.value)}
              placeholder="YAML 内容，如 true、[tag1, tag2] 或文本"
              multiline
              minRows={1}
              maxRows={8}
              fullWidth
            />
            <Tooltip title="删除字段">
              <IconButton
                color="error"
                disabled={busy || readOnly}
                onClick={() => remove(entry.rowId)}
              >
                <DeleteOutline />
              </IconButton>
            </Tooltip>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" sx={{ mt: 2, justifyContent: "space-between" }}>
        <Button startIcon={<AddOutlined />} disabled={busy || readOnly} onClick={add}>
          添加字段
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveOutlined />}
          onClick={onSave}
          disabled={busy || readOnly}
        >
          保存 Frontmatter
        </Button>
      </Stack>
      <Alert severity="info" sx={{ mt: 2 }}>
        字段内容按 YAML 解析。字符串可直接填写；数组可填写 <code>[tag1, tag2]</code>
        ，布尔值填写 <code>true</code> 或 <code>false</code>。字段名和内容都可修改。
      </Alert>
    </Box>
  );
}
