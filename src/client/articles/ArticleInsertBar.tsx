import ChecklistOutlined from "@mui/icons-material/ChecklistOutlined";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import LinkOutlined from "@mui/icons-material/LinkOutlined";
import TableChartOutlined from "@mui/icons-material/TableChartOutlined";
import { Button, Stack, Typography } from "@mui/material";

interface ArticleInsertBarProps {
  disabled: boolean;
  onTable: () => void;
  onTask: () => void;
  onLink: () => void;
  onImage: () => void;
}

export function ArticleInsertBar({
  disabled,
  onTable,
  onTask,
  onLink,
  onImage,
}: ArticleInsertBarProps) {
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
      <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
        插入内容
      </Typography>
      <Button size="small" startIcon={<TableChartOutlined />} disabled={disabled} onClick={onTable}>
        表格
      </Button>
      <Button size="small" startIcon={<ChecklistOutlined />} disabled={disabled} onClick={onTask}>
        任务列表
      </Button>
      <Button size="small" startIcon={<LinkOutlined />} disabled={disabled} onClick={onLink}>
        链接
      </Button>
      <Button size="small" startIcon={<ImageOutlined />} disabled={disabled} onClick={onImage}>
        图片
      </Button>
    </Stack>
  );
}
