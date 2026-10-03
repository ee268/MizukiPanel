import FormatBoldOutlined from "@mui/icons-material/FormatBoldOutlined";
import FormatItalicOutlined from "@mui/icons-material/FormatItalicOutlined";
import FormatListBulletedOutlined from "@mui/icons-material/FormatListBulletedOutlined";
import FormatListNumberedOutlined from "@mui/icons-material/FormatListNumberedOutlined";
import FormatQuoteOutlined from "@mui/icons-material/FormatQuoteOutlined";
import CodeOutlined from "@mui/icons-material/CodeOutlined";
import UndoOutlined from "@mui/icons-material/UndoOutlined";
import RedoOutlined from "@mui/icons-material/RedoOutlined";
import ChecklistOutlined from "@mui/icons-material/ChecklistOutlined";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import LinkOutlined from "@mui/icons-material/LinkOutlined";
import TableChartOutlined from "@mui/icons-material/TableChartOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import {
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { ArticleModeSelect } from "./ArticleModeSelect";
import type { EditorFormatState, FormatAction } from "./editor-format";

interface ArticleFormatToolbarProps {
  disabled: boolean;
  saving: boolean;
  format: EditorFormatState;
  onAction: (action: FormatAction) => void;
  onHeading: (level: number) => void;
  onTable: () => void;
  onTask: () => void;
  onLink: () => void;
  onImage: () => void;
  onSourceMode: () => void;
  onSave: () => void;
}

interface FormatButtonProps {
  label: string;
  icon: ReactNode;
  selected?: boolean;
  disabled: boolean;
  onClick: () => void;
}

function FormatButton({ label, icon, selected, disabled, onClick }: FormatButtonProps) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          size="small"
          aria-label={label}
          aria-pressed={selected}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClick}
          color={selected ? "primary" : "default"}
          sx={{ backgroundColor: selected ? "action.selected" : undefined }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}

export function ArticleFormatToolbar({
  disabled,
  saving,
  format,
  onAction,
  onHeading,
  onTable,
  onTask,
  onLink,
  onImage,
  onSourceMode,
  onSave,
}: ArticleFormatToolbarProps) {
  return (
    <Box
      component="div"
      role="toolbar"
      aria-label="文章正文格式工具栏"
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 0.5,
        p: 1,
        position: "sticky",
        top: { xs: 56, sm: 64 },
        zIndex: 2,
        backgroundColor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
      <ArticleModeSelect
        mode="visual"
        onChange={(mode) => {
          if (mode === "source") {
            onSourceMode();
          }
        }}
      />
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <FormControl size="small" sx={{ minWidth: 105, mr: 0.5 }}>
        <Select
          value={format.heading}
          disabled={disabled}
          aria-label="标题级别"
          onChange={(event) => onHeading(Number(event.target.value))}
        >
          <MenuItem value={0}>正文</MenuItem>
          {Array.from({ length: 6 }, (_, index) => (
            <MenuItem key={index + 1} value={index + 1}>
              标题 {index + 1}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormatButton
        label="粗体 (Ctrl+B)"
        icon={<FormatBoldOutlined />}
        selected={format.bold}
        disabled={disabled}
        onClick={() => onAction("bold")}
      />
      <FormatButton
        label="斜体 (Ctrl+I)"
        icon={<FormatItalicOutlined />}
        selected={format.italic}
        disabled={disabled}
        onClick={() => onAction("italic")}
      />
      <FormatButton
        label="链接 (Ctrl+K)"
        icon={<LinkOutlined />}
        selected={format.link}
        disabled={disabled}
        onClick={onLink}
      />
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <FormatButton
        label="无序列表"
        icon={<FormatListBulletedOutlined />}
        selected={format.bullet && !format.task}
        disabled={disabled}
        onClick={() => onAction("bullet")}
      />
      <FormatButton
        label="有序列表"
        icon={<FormatListNumberedOutlined />}
        selected={format.ordered}
        disabled={disabled}
        onClick={() => onAction("ordered")}
      />
      <FormatButton
        label="任务列表"
        icon={<ChecklistOutlined />}
        selected={format.task}
        disabled={disabled}
        onClick={onTask}
      />
      <FormatButton
        label="引用"
        icon={<FormatQuoteOutlined />}
        selected={format.quote}
        disabled={disabled}
        onClick={() => onAction("quote")}
      />
      <FormatButton
        label="代码块 (Ctrl+Shift+K)"
        icon={<CodeOutlined />}
        selected={format.code}
        disabled={disabled}
        onClick={() => onAction("code")}
      />
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <FormatButton
        label="插入表格"
        icon={<TableChartOutlined />}
        disabled={disabled}
        onClick={onTable}
      />
      <FormatButton
        label="插入图片"
        icon={<ImageOutlined />}
        disabled={disabled}
        onClick={onImage}
      />
      <FormatButton
        label="撤销 (Ctrl+Z)"
        icon={<UndoOutlined />}
        disabled={disabled || !format.canUndo}
        onClick={() => onAction("undo")}
      />
      <FormatButton
        label="重做 (Ctrl+Y)"
        icon={<RedoOutlined />}
        disabled={disabled || !format.canRedo}
        onClick={() => onAction("redo")}
      />
      <Stack direction="row" sx={{ ml: "auto", alignItems: "center" }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: "none", lg: "block" }, mr: 1 }}
        >
          Ctrl+S 保存
        </Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<SaveOutlined />}
          disabled={saving}
          onClick={onSave}
          onMouseDown={(event) => event.preventDefault()}
        >
          保存正文
        </Button>
      </Stack>
    </Box>
  );
}
