import {
  Alert,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { useScopedSettings } from "./useScopedSettings";
import { ScopedCard } from "./WorkspaceSettingsForms";
export function MediaSettingsForm({
  controller,
  projectRoot,
}: {
  controller: ReturnType<typeof useScopedSettings>;
  projectRoot: string;
}) {
  const value = controller.value;
  const select = (label: string, key: string, items: [string, string][], helperText?: string) => (
    <TextField
      fullWidth
      select
      label={label}
      value={value[key]}
      helperText={helperText}
      onChange={(event) => controller.change({ [key]: event.target.value })}
    >
      {items.map(([id, name]) => (
        <MenuItem key={id} value={id}>
          {name}
        </MenuItem>
      ))}
    </TextField>
  );
  return (
    <ScopedCard title="媒体默认值与图片处理" controller={controller}>
      <Stack spacing={3}>
        {!projectRoot ? (
          <Alert severity="info">连接项目后可设置媒体默认值。</Alert>
        ) : (
          <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {projectRoot}
          </Typography>
        )}
        {select(
          "默认上传范围",
          "scope",
          [
            ["public", "公共图片 /images/"],
            ["article", "文章相对资源"],
          ],
          "下次打开媒体管理时填入，可在上传表单临时调整。",
        )}
        <TextField
          fullWidth
          label="默认子目录"
          value={value.folder}
          onChange={(event) => controller.change({ folder: event.target.value })}
          helperText="相对于公共图片目录或所选文章目录，留空不创建子目录；使用 / 分隔。"
        />
        {select(
          "文件命名",
          "naming",
          [
            ["original", "保留原文件名"],
            ["date", "系统日期前缀 YYYY-MM-DD"],
            ["unique", "随机唯一名称"],
          ],
          "预览确定目标文件名；重名会拒绝上传，不覆盖已有文件。",
        )}
        {select(
          "图片引用格式",
          "referenceFormat",
          [
            ["auto", "默认：复制路径，插入 Markdown"],
            ["markdown", "Markdown 图片语法"],
            ["html", "HTML img 标签"],
          ],
          "公共图片使用 /images/ 路径；文章图片插入时使用相对于当前文章的路径。",
        )}
        {select(
          "默认替代文字",
          "alt",
          [
            ["filename", "文件名（不含扩展名）"],
            ["empty", "留空"],
          ],
          "上传和插入前可编辑；装饰性图片可留空。",
        )}
        <FormControlLabel
          control={
            <Switch
              checked={value.compress === true}
              onChange={(_, compress) => controller.change({ compress })}
            />
          }
          label="压缩图片"
        />
        <TextField
          label="压缩质量"
          type="number"
          disabled={!value.compress}
          value={value.quality}
          onChange={(event) => controller.change({ quality: Number(event.target.value) })}
          slotProps={{ htmlInput: { min: 50, max: 100 } }}
          helperText="50—100，默认 85；JPEG、WebP、AVIF 使用此质量，PNG 使用无损压缩。"
        />
        <FormControlLabel
          control={
            <Switch
              checked={value.resize === true}
              onChange={(_, resize) => controller.change({ resize })}
            />
          }
          label="限制图片最大尺寸"
        />
        <TextField
          label="最大长边（像素）"
          type="number"
          disabled={!value.resize}
          value={value.maxDimension}
          onChange={(event) => controller.change({ maxDimension: Number(event.target.value) })}
          slotProps={{ htmlInput: { min: 64, max: 8192 } }}
          helperText="64—8192，默认 1920；保持比例，不放大小图。"
        />
        {select(
          "转换格式",
          "format",
          [
            ["original", "保持原格式"],
            ["png", "PNG"],
            ["jpeg", "JPEG"],
            ["webp", "WebP"],
            ["avif", "AVIF"],
          ],
          "保持原格式且关闭压缩/缩放时上传原始字节。透明图转换 JPEG 会提示并保留原图。",
        )}
        <Alert severity="info">
          SVG 与动画图保持原样。图片处理最多 3200 万像素、8 秒，文件上限 20
          MB；失败时可明确选择上传原图。处理和预览不会自动写入文章或图片。
        </Alert>
      </Stack>
    </ScopedCard>
  );
}
