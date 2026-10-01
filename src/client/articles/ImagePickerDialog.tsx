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

interface ImagePickerDialogProps {
  open: boolean;
  articleId: string;
  onClose: () => void;
  onInsert: (alt: string, src: string) => void;
}

type ImageSource = "library" | "url";
type MediaScope = "public" | "article";

export function ImagePickerDialog({ open, articleId, onClose, onInsert }: ImagePickerDialogProps) {
  const [source, setSource] = useState<ImageSource>("library");
  const [scope, setScope] = useState<MediaScope>("public");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    setError("");
    setLoading(true);
    void api<{ media: MediaItem[] }>("/api/media")
      .then((data) => {
        if (active) {
          setItems(data.media);
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
  }, [open]);

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
  const valid = validImageReference(reference) && Boolean(mediaPreviewUrl(articleId, reference));

  function select(item: MediaItem) {
    setSelected(item);
    setAlt(
      item.path
        .split("/")
        .at(-1)
        ?.replace(/\.[^.]+$/, "") ?? "",
    );
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
                  <MenuItem value="article">文章资源</MenuItem>
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
          {reference && (
            <Typography
              variant="body2"
              color={valid ? "text.secondary" : "error.main"}
              sx={{ overflowWrap: "anywhere" }}
            >
              {valid ? `Markdown 路径：${reference}` : "图片路径无效或超出文章资源目录"}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          disabled={!valid}
          onClick={() => onInsert(alt.trim(), reference)}
        >
          插入图片
        </Button>
      </DialogActions>
    </Dialog>
  );
}
