import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import type { MediaItem } from "../types";
import type { MediaScope } from "./types";

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface MediaGalleryProps {
  items: MediaItem[];
  scope: MediaScope;
  query: string;
  readOnly: boolean;
  onScopeChange: (scope: MediaScope) => void;
  onQueryChange: (query: string) => void;
  onCopy: (reference: string) => void;
  onDelete: (item: MediaItem) => void;
}

export function MediaGallery({
  items,
  scope,
  query,
  readOnly,
  onScopeChange,
  onQueryChange,
  onCopy,
  onDelete,
}: MediaGalleryProps) {
  return (
    <>
      <Paper variant="outlined">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ px: 2, justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Tabs value={scope} onChange={(_, value: MediaScope) => onScopeChange(value)}>
            <Tab value="public" label="公共图片" />
            <Tab value="article" label="文章资源" />
          </Tabs>
          <TextField
            placeholder="筛选文件路径"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            sx={{ my: 1, width: { sm: 280 } }}
          />
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        {items.map((item) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 3 }} key={`${item.scope}-${item.path}`}>
            <Card variant="outlined">
              <CardMedia
                component="img"
                image={`/api/media/file?scope=${item.scope}&path=${encodeURIComponent(item.path)}`}
                sx={{ height: 180, objectFit: "contain", bgcolor: "grey.100" }}
              />
              <CardContent>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: "monospace", overflowWrap: "anywhere", minHeight: 42 }}
                >
                  {item.path}
                </Typography>
                <Stack direction="row" sx={{ mt: 1, justifyContent: "space-between" }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatSize(item.size)}
                  </Typography>
                  <Chip
                    size="small"
                    color={item.referencedBy.length ? "info" : "default"}
                    label={`${item.referencedBy.length} 处引用`}
                  />
                </Stack>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<ContentCopyOutlined />}
                  onClick={() => onCopy(item.reference)}
                >
                  复制引用
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutline />}
                  disabled={Boolean(item.referencedBy.length) || readOnly}
                  onClick={() => onDelete(item)}
                >
                  删除
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {!items.length && <Alert severity="info">当前范围没有匹配的媒体。</Alert>}
    </>
  );
}
