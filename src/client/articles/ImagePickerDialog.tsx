import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { errorMessage } from "../shared/errors";
import type { MediaItem } from "../types";
import { articleMediaReference, mediaPreviewUrl, validImageReference } from "./article-media";
import { mediaAlt, type MediaSettings } from "../../shared/media-settings";

interface ImagePickerDialogProps {
  open: boolean;
  articleId: string;
  publicOnly?: boolean;
  onClose: () => void;
  onInsert: (alt: string, src: string, format: "markdown" | "html") => void;
}

type ImageSource = "library" | "url";
type MediaScope = "public" | "article";

export function ImagePickerDialog({
  open,
  articleId,
  publicOnly = false,
  onClose,
  onInsert,
}: ImagePickerDialogProps) {
  const [source, setSource] = useState<ImageSource>("library");
  const [scope, setScope] = useState<MediaScope>("public");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [format, setFormat] = useState<"markdown" | "html">("markdown");
  const [altPolicy, setAltPolicy] = useState<MediaSettings["alt"]>("filename");

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    setSource("library");
    setScope("public");
    setSelected(null);
    setQuery("");
    setUrl("");
    setAlt("");
    setFormat("markdown");
    setAltPolicy("filename");
    setError("");
    setLoading(true);
    void api<{ media: MediaItem[]; preferences: { values: MediaSettings } }>("/api/media")
      .then((data) => {
        if (active) {
          setItems(data.media);
          setScope(publicOnly ? "public" : data.preferences.values.scope);
          setFormat(data.preferences.values.referenceFormat === "html" ? "html" : "markdown");
          setAltPolicy(data.preferences.values.alt);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(errorMessage(cause, "媒体库读取失败"));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, publicOnly]);

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.scope === scope && item.path.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [items, scope, query],
  );
  const reference =
    source === "library"
      ? selected
        ? articleMediaReference(articleId, selected)
        : ""
      : url.trim();
  const valid =
    validImageReference(reference) &&
    Boolean(mediaPreviewUrl(articleId, reference)) &&
    (!publicOnly || /^https?:\/\//i.test(reference) || reference.startsWith("/images/"));

  function select(item: MediaItem) {
    setSelected(item);
    setAlt(mediaAlt(item.path, altPolicy));
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>插入图片</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Tabs value={source} onChange={(_, value: ImageSource) => setSource(value)}>
            <Tab value="library" label="媒体库" />
            <Tab value="url" label="URL 或项目路径" />
          </Tabs>

          {source === "library" ? (
            <>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  select
                  label="资源范围"
                  value={scope}
                  onChange={(event) => {
                    setScope(event.target.value as MediaScope);
                    setSelected(null);
                  }}
                  sx={{ minWidth: 170 }}
                >
                  <MenuItem value="public">公共图片</MenuItem>
                  {!publicOnly && <MenuItem value="article">文章资源</MenuItem>}
                </TextField>
                <TextField
                  label="筛选文件路径"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  fullWidth
                />
              </Stack>
              {loading && <CircularProgress size={24} />}
              {error && <Alert severity="error">{error}</Alert>}
              {!loading && !error && !visibleItems.length && (
                <Alert severity="info">当前范围没有图片。可到媒体管理上传，或使用 URL 插入。</Alert>
              )}
              <List
                sx={{
                  maxHeight: 300,
                  overflowY: "auto",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                {visibleItems.map((item) => (
                  <ListItemButton
                    key={`${item.scope}:${item.path}`}
                    selected={selected?.scope === item.scope && selected.path === item.path}
                    onClick={() => select(item)}
                  >
                    <Box
                      component="img"
                      src={`/api/media/file?scope=${item.scope}&path=${encodeURIComponent(item.path)}`}
                      alt=""
                      loading="lazy"
                      sx={{ width: 56, height: 44, objectFit: "contain", mr: 2 }}
                    />
                    <ListItemText
                      primary={item.path}
                      secondary={item.scope === "public" ? "公共图片" : "文章资源"}
                    />
                  </ListItemButton>
                ))}
              </List>
            </>
          ) : (
            <TextField
              label="图片 URL 或项目内路径"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/photo.png、/images/photo.png 或 ./photo.png"
              fullWidth
              autoFocus
            />
          )}

          <TextField
            label="替代文字"
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            helperText="用于图片无法显示时的说明；装饰性图片可留空。"
            fullWidth
          />
          <TextField
            fullWidth
            select
            label="插入语法"
            value={format}
            onChange={(event) => setFormat(event.target.value as "markdown" | "html")}
          >
            <MenuItem value="markdown">Markdown 图片</MenuItem>
            <MenuItem value="html">HTML img 图片</MenuItem>
          </TextField>
          {reference && (
            <Typography
              variant="body2"
              color={valid ? "text.secondary" : "error.main"}
              sx={{ overflowWrap: "anywhere" }}
            >
              {valid ? `图片路径：${reference}` : "图片路径无效或超出文章资源目录"}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          disabled={!valid || loading}
          onClick={() => onInsert(alt.trim(), reference, format)}
        >
          插入图片
        </Button>
      </DialogActions>
    </Dialog>
  );
}
