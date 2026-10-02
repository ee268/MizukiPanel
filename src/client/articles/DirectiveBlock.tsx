import GitHub from "@mui/icons-material/GitHub";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import {
  Alert,
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import {
  parseMizukiDirective,
  updateMizukiDirective,
  type DirectiveChanges,
  type MizukiDirective,
} from "../../lib/articles/mizuki-directives";
import { mediaPreviewUrl } from "./article-media";

interface DirectiveBlockProps {
  articleId: string;
  directive: MizukiDirective;
  readOnly: boolean;
  onChange: (raw: string) => void;
  onValidityChange: (valid: boolean) => void;
}

const admonitionNames: Record<string, string> = {
  note: "提示",
  tip: "技巧",
  important: "重要",
  warning: "警告",
  caution: "注意",
};

export function DirectiveBlock({
  articleId,
  directive,
  readOnly,
  onChange,
  onValidityChange,
}: DirectiveBlockProps) {
  const [changes, setChanges] = useState<DirectiveChanges>({});
  const [invalid, setInvalid] = useState(false);
  const title = changes.title ?? directive.title;
  const repo = changes.repo ?? directive.repo;
  const columns = changes.columns ?? directive.columns;
  const aspect = changes.aspect ?? directive.aspect;
  const fit = changes.fit ?? directive.fit;
  const body = changes.body ?? directive.body;
  const previewRaw = updateMizukiDirective(directive, changes);
  const images = previewRaw
    ? (parseMizukiDirective(previewRaw)?.images ?? directive.images)
    : directive.images;

  function change(next: DirectiveChanges) {
    const updated = { ...changes, ...next };
    setChanges(updated);
    const raw = updateMizukiDirective(directive, updated);
    setInvalid(raw === null);
    onValidityChange(raw !== null);
    if (raw !== null) {
      onChange(raw);
    }
  }

  const heading =
    directive.kind === "admonition"
      ? `${admonitionNames[directive.name] ?? directive.name}块`
      : directive.kind === "github"
        ? "GitHub 仓库卡片"
        : "图片网格";

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderLeft: "4px solid",
        borderLeftColor:
          directive.name === "warning" || directive.name === "caution"
            ? "warning.main"
            : "primary.main",
        backgroundColor: "action.hover",
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {directive.kind === "github" ? (
            <GitHub />
          ) : directive.kind === "grid" ? (
            <ImageOutlined />
          ) : (
            <InfoOutlined />
          )}
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {heading}
          </Typography>
          <Chip size="small" label={`:::${directive.name}`} />
        </Stack>

        {directive.kind === "admonition" && (
          <>
            <TextField
              label="标题（可选）"
              value={title}
              onChange={(event) => change({ title: event.target.value })}
              disabled={readOnly}
              size="small"
              fullWidth
            />
            <TextField
              label="提示内容（Markdown）"
              value={body}
              onChange={(event) => change({ body: event.target.value })}
              disabled={readOnly}
              multiline
              minRows={3}
              fullWidth
            />
          </>
        )}

        {directive.kind === "github" && (
          <TextField
            label="仓库（owner/repo）"
            value={repo}
            onChange={(event) => change({ repo: event.target.value })}
            disabled={readOnly}
            error={invalid}
            size="small"
            fullWidth
          />
        )}

        {directive.kind === "grid" && (
          <>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>列数</InputLabel>
                <Select
                  label="列数"
                  value={columns}
                  onChange={(event) => change({ columns: event.target.value })}
                  disabled={readOnly}
                >
                  <MenuItem value="">默认</MenuItem>
                  {[1, 2, 3, 4, 5, 6].map((count) => (
                    <MenuItem key={count} value={String(count)}>
                      {count} 列
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="宽高比（例如 16/9）"
                value={aspect}
                onChange={(event) => change({ aspect: event.target.value })}
                disabled={readOnly}
                size="small"
                sx={{ minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>填充方式</InputLabel>
                <Select
                  label="填充方式"
                  value={fit}
                  onChange={(event) => change({ fit: event.target.value })}
                  disabled={readOnly}
                >
                  <MenuItem value="">默认</MenuItem>
                  <MenuItem value="cover">裁切填充</MenuItem>
                  <MenuItem value="contain">完整显示</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 1,
              }}
            >
              {images.map((image, index) => {
                const preview = mediaPreviewUrl(articleId, image.url);
                return (
                  <Paper
                    key={`${image.url}:${index}`}
                    variant="outlined"
                    sx={{ overflow: "hidden" }}
                  >
                    {preview && (
                      <Box
                        component="img"
                        src={preview}
                        alt={image.alt}
                        loading="lazy"
                        sx={{ width: "100%", height: 110, objectFit: "cover", display: "block" }}
                      />
                    )}
                    <Typography
                      variant="caption"
                      sx={{ display: "block", p: 1, overflowWrap: "anywhere" }}
                    >
                      {image.alt || image.url}
                    </Typography>
                  </Paper>
                );
              })}
            </Box>
            <TextField
              label="网格内容（每张图片使用 Markdown 图片语法）"
              value={body}
              onChange={(event) => change({ body: event.target.value })}
              disabled={readOnly}
              multiline
              minRows={3}
              fullWidth
              slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: 14 } } }}
            />
          </>
        )}

        {invalid && (
          <Alert severity="warning">当前指令语法无效，修改不会写入草稿。请修正后再保存文章。</Alert>
        )}
      </Stack>
    </Paper>
  );
}
