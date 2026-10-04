import EditOutlined from "@mui/icons-material/EditOutlined";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { parseHtmlImages } from "../../lib/articles/html-images";
import { validateSourceCardEdit } from "../../lib/articles/mdx-source-edit";
import type { SegmentedArticle, SourceSegment } from "../../lib/articles/source-islands";
import { mediaPreviewUrl } from "./article-media";

interface HtmlImageCardProps {
  articleId: string;
  article: SegmentedArticle;
  segment: SourceSegment;
  readOnly: boolean;
  onChange: (raw: string) => void;
  onValidityChange: (valid: boolean) => void;
}

export function HtmlImageCard({
  articleId,
  article,
  segment,
  readOnly,
  onChange,
  onValidityChange,
}: HtmlImageCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(segment.raw);
  const [reason, setReason] = useState<string | null>(null);
  const images = parseHtmlImages(draft) ?? parseHtmlImages(segment.raw) ?? [];

  function change(next: string) {
    setDraft(next);
    const parsed = parseHtmlImages(next);
    const result = parsed
      ? validateSourceCardEdit(article, segment, next)
      : { source: null, reason: "请保留有效的独立 <img> 标签" };
    setReason(result.reason);
    onValidityChange(result.reason === null);
    if (result.source !== null) onChange(result.source);
  }

  function cancel() {
    setDraft(segment.raw);
    setReason(null);
    setEditing(false);
    onValidityChange(true);
    onChange(segment.raw);
  }

  return (
    <Stack spacing={1}>
      {editing && !readOnly && (
        <Stack spacing={1}>
          <TextField
            label="图片 HTML 源码"
            value={draft}
            onChange={(event) => change(event.target.value)}
            error={reason !== null}
            fullWidth
            multiline
            minRows={2}
            slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: 14 } } }}
          />
          {reason && <Alert severity="warning">{reason}。修正前无法保存正文。</Alert>}
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => setEditing(false)} disabled={reason !== null}>
              完成
            </Button>
            <Button size="small" onClick={cancel}>
              取消修改
            </Button>
          </Stack>
        </Stack>
      )}
      {images.map((image, index) => {
        const src = mediaPreviewUrl(articleId, image.src);
        return (
          <Box
            key={`${image.src}:${index}`}
            component="button"
            type="button"
            aria-label={`编辑图片源码：${image.alt || image.src}`}
            onClick={() => !readOnly && setEditing(true)}
            sx={{
              display: "block",
              p: 0,
              border: 0,
              background: "transparent",
              cursor: readOnly ? "default" : "pointer",
              textAlign: "left",
              width: "fit-content",
              maxWidth: "100%",
            }}
          >
            {src ? (
              <Box
                component="img"
                src={src}
                alt={image.alt}
                title={image.title}
                loading="lazy"
                sx={{
                  display: "block",
                  maxWidth: "100%",
                  height: "auto",
                  zoom: image.zoom ?? 1,
                  borderRadius: 1,
                }}
              />
            ) : (
              <Typography>{image.alt || "图片地址不可用"}</Typography>
            )}
          </Box>
        );
      })}
      {!editing && !readOnly && (
        <Button
          size="small"
          startIcon={<EditOutlined />}
          onClick={() => setEditing(true)}
          sx={{ alignSelf: "flex-start" }}
        >
          编辑图片源码
        </Button>
      )}
    </Stack>
  );
}
