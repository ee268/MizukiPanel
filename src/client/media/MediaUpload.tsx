import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { useMedia } from "./useMedia";
import { imageReference } from "../../shared/media-settings";
const size = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
export function MediaUpload({
  controller: media,
  readOnly,
}: {
  controller: ReturnType<typeof useMedia>;
  readOnly: boolean;
}) {
  const prepared = media.preparation;
  const disabled = readOnly || media.busy || !media.data;
  const reference =
    media.variant === "processed" ? prepared?.processedReference : prepared?.originalReference;
  const path = media.variant === "processed" ? prepared?.processedPath : prepared?.originalPath;
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">上传图片</Typography>
        <Typography variant="body2" color="text.secondary">
          支持 PNG、JPEG、GIF、WebP、AVIF、SVG，最大 20 MB；上传前预览，不覆盖同名文件。
        </Typography>
        {media.data?.preferences.warnings.map((warning) => (
          <Alert key={warning} severity="warning">
            {warning}
          </Alert>
        ))}
        <Box component="form" onSubmit={media.prepare}>
          <Box component="fieldset" disabled={disabled} sx={{ p: 0, m: 0, border: 0, minWidth: 0 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  select
                  label="存储位置"
                  value={media.scope}
                  onChange={(event) => media.setScope(event.target.value as "public" | "article")}
                >
                  <MenuItem value="public">公共图片 /images/</MenuItem>
                  <MenuItem value="article">文章相对资源</MenuItem>
                </TextField>
              </Grid>
              {media.scope === "article" && (
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    required
                    select
                    label="所属文章"
                    value={media.articleId}
                    onChange={(event) => media.setArticleId(event.target.value)}
                  >
                    {media.data?.articles.map((article) => (
                      <MenuItem value={article.id} key={article.id}>
                        {article.title} · {article.id}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  label="子目录（可留空）"
                  value={media.folder}
                  onChange={(event) => media.setFolder(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<CloudUploadOutlined />}
                  fullWidth
                  disabled={disabled}
                  sx={{ height: 40, overflowWrap: "anywhere" }}
                >
                  {media.file?.name ?? "选择图片"}
                  <input
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
                    disabled={disabled}
                    onChange={(event) => {
                      media.setFile(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                </Button>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="替代文字"
                  value={media.alt}
                  onChange={(event) => media.setAlt(event.target.value)}
                  helperText="用于复制图片引用；装饰性图片可留空。"
                />
              </Grid>
            </Grid>
            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap", gap: 1 }}>
              <Button
                type="submit"
                variant="outlined"
                disabled={
                  disabled || !media.file || (media.scope === "article" && !media.articleId)
                }
              >
                {media.busy ? "正在处理…" : prepared ? "重新预览上传结果" : "预览上传结果"}
              </Button>
              <Button disabled={disabled} onClick={media.resetDefaults}>
                恢复上传默认值
              </Button>
            </Stack>
          </Box>
        </Box>
        <Button
          disabled={media.busy}
          onClick={() => void media.refresh()}
          sx={{ alignSelf: "flex-start" }}
        >
          读取最新偏好
        </Button>
        {prepared && (
          <Stack spacing={2}>
            <Alert severity={prepared.status === "failed" ? "warning" : "info"}>
              {prepared.message}
            </Alert>
            <Typography variant="body2">
              原图 {size(prepared.originalSize)}
              {prepared.width && prepared.height ? ` · ${prepared.width}×${prepared.height}` : ""}
              {prepared.processedSize !== null
                ? ` → 处理后 ${size(prepared.processedSize)} · ${prepared.outputWidth}×${prepared.outputHeight}`
                : ""}
            </Typography>
            <RadioGroup
              row
              aria-label="上传版本"
              value={media.variant}
              onChange={(event) => media.setVariant(event.target.value as "original" | "processed")}
            >
              <FormControlLabel
                value="original"
                control={<Radio disabled={disabled || !prepared.originalAvailable} />}
                label={prepared.originalAvailable ? "上传原图" : "原图目标已存在"}
              />
              {prepared.processedPath && (
                <FormControlLabel
                  value="processed"
                  control={<Radio disabled={disabled || !prepared.processedAvailable} />}
                  label={prepared.processedAvailable ? "上传处理后的图片" : "处理后目标已存在"}
                />
              )}
            </RadioGroup>
            {reference && (
              <>
                <Typography sx={{ overflowWrap: "anywhere" }}>目标文件：{path}</Typography>
                <TextField
                  fullWidth
                  multiline
                  label="图片引用预览"
                  value={imageReference(
                    reference,
                    media.alt,
                    prepared.referenceFormat === "html" ? "html" : "markdown",
                  )}
                  slotProps={{ input: { readOnly: true } }}
                />
                <Box
                  component="img"
                  alt="上传前预览"
                  src={`/api/media/prepared?token=${encodeURIComponent(prepared.token)}&variant=${media.variant || "original"}`}
                  sx={{
                    maxWidth: "100%",
                    maxHeight: 240,
                    objectFit: "contain",
                    alignSelf: "flex-start",
                  }}
                />
              </>
            )}
            <Typography variant="caption" color="text.secondary">
              预览有效至 {new Date(prepared.expiresAt).toLocaleTimeString()}
              。修改范围、目录、文件或媒体偏好后需重新预览。
            </Typography>
            <Button
              variant="contained"
              disabled={disabled || !media.variant}
              onClick={() => void media.upload()}
              sx={{ alignSelf: "flex-start" }}
            >
              上传
            </Button>
          </Stack>
        )}
        {media.uploaded && (
          <Alert severity="success">
            <Stack spacing={1}>
              <Typography sx={{ overflowWrap: "anywhere" }}>
                已上传 {media.uploaded.fileName} · {size(media.uploaded.size)}
              </Typography>
              <TextField
                fullWidth
                multiline
                label="已上传图片引用"
                value={imageReference(
                  media.uploaded.reference,
                  media.uploaded.alt,
                  media.data?.preferences.values.referenceFormat === "html" ? "html" : "markdown",
                )}
                slotProps={{ input: { readOnly: true } }}
              />
              <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                路径：{media.uploaded.reference}
              </Typography>
            </Stack>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
