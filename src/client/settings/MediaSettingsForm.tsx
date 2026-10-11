import {
  Alert,
  Autocomplete,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api";
import { errorMessage } from "../shared/errors";
import type { ImageFolder } from "../../shared/project-media";
import type { useScopedSettings } from "./useScopedSettings";
import { ScopedCard } from "./WorkspaceSettingsForms";
import { ContentLoading } from "../components/ContentLoading";
export function MediaSettingsForm({
  controller,
  projectRoot,
}: {
  controller: ReturnType<typeof useScopedSettings>;
  projectRoot: string;
}) {
  const value = controller.value;
  const [directories, setDirectories] = useState<{
    folders: ImageFolder[];
    defaultFolder: string;
    fallbackFolder: string;
    warnings: string[];
  } | null>(null);
  const [directoryError, setDirectoryError] = useState("");
  useEffect(() => {
    const request = new AbortController();
    setDirectories(null);
    setDirectoryError("");
    if (projectRoot)
      void api<{
        folders: ImageFolder[];
        defaultFolder: string;
        fallbackFolder: string;
        warnings: string[];
      }>("/api/media/folders", { signal: request.signal })
        .then((result) => {
          if (!request.signal.aborted) setDirectories(result);
        })
        .catch((error) => {
          if (!request.signal.aborted) setDirectoryError(errorMessage(error, "图片文件夹读取失败"));
        });
    return () => request.abort();
  }, [projectRoot]);
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
        {directoryError && <Alert severity="warning">{directoryError}</Alert>}
        {projectRoot && !directories && !directoryError && (
          <ContentLoading
            heading="正在展开图片文件夹"
            description="正在读取可用的上传目录"
            kind="media"
            size="inline"
          />
        )}
        {directories?.warnings.map((warning) => (
          <Alert severity="warning" key={warning}>
            {warning}
          </Alert>
        ))}
        <Autocomplete
          freeSolo
          options={directories?.folders.map((folder) => folder.path) ?? []}
          inputValue={String(value.storageFolder ?? "")}
          onInputChange={(_, storageFolder) =>
            controller.change({ storageFolder, scope: "public", folder: "", alt: "filename" })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="默认存储文件夹（绝对路径）"
              placeholder={directories?.fallbackFolder}
              helperText={`选择项目内的图片文件夹，也可填写新文件夹绝对路径；留空使用${directories?.fallbackFolder ? ` ${directories.fallbackFolder}` : "公共图片目录"}。`}
            />
          )}
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
          "公共目录图片复制站点引用；源码和文档目录图片复制实际文件路径。替代文字自动使用文件名。",
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
