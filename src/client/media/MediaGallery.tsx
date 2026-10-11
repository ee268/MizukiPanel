import { useMemo, useRef, useState } from "react";
import { keyframes } from "@emotion/react";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  Chip,
  Grid,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ProjectImage, ImageFolder } from "../../shared/project-media";
import { CatalogCardSlot } from "../components/CatalogCardSlot";

const enterFolder = keyframes`from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; }`;
const folderName = (folder: ImageFolder) =>
  folder.relativePath === "." || !folder.relativePath ? "项目根目录" : folder.relativePath;

type Actions = {
  readOnly: boolean;
  onCopy: (item: ProjectImage) => void;
  onDelete: (item: ProjectImage) => void;
};
export function MediaGallery({
  items,
  folders,
  query,
  onQueryChange,
  ...actions
}: Actions & {
  items: ProjectImage[];
  folders: ImageFolder[];
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const gallery = useRef<HTMLDivElement>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const selectedFolder = folders.find((folder) => folder.path === selectedPath);
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.folder, (counts.get(item.folder) ?? 0) + 1);
    const search = query.trim().replace(/\\/g, "/").toLocaleLowerCase();
    return folders
      .map((folder) => ({ folder, count: counts.get(folder.path) ?? 0 }))
      .filter(
        ({ folder, count }) =>
          count ||
          !search ||
          `${folder.path} ${folder.relativePath}`
            .replace(/\\/g, "/")
            .toLocaleLowerCase()
            .includes(search),
      );
  }, [folders, items, query]);
  const selectFolder = (path: string | null) => {
    setSelectedPath(path);
    requestAnimationFrame(() =>
      gallery.current?.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  };
  const folderImages = selectedFolder
    ? items.filter((item) => item.folder === selectedFolder.path)
    : [];
  return (
    <Stack
      ref={gallery}
      spacing={2}
      sx={{ scrollMarginTop: "calc(var(--mizuki-panel-header-height, 65px) + 16px)" }}
    >
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Box>
            <Typography variant="h6">公共图片</Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedFolder
                ? `${folderImages.length} 张图片 · 当前文件夹`
                : `${items.length} 张图片 · ${groups.length} 个文件夹`}
            </Typography>
          </Box>
          <TextField
            label="搜索图片或文件夹"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            sx={{ width: { xs: "100%", sm: 320 } }}
          />
        </Stack>
      </Paper>
      {selectedFolder ? (
        <Stack
          key={selectedFolder.path}
          spacing={2}
          component="section"
          aria-label="文件夹图片"
          sx={{
            animation: `${enterFolder} 260ms ease-out`,
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        >
          <Stack spacing={1}>
            <Button
              startIcon={<ArrowBackOutlined />}
              onClick={() => selectFolder(null)}
              sx={{ alignSelf: "flex-start" }}
            >
              返回文件夹
            </Button>
            <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>
              {folderName(selectedFolder)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {selectedFolder.path}
            </Typography>
          </Stack>
          {folderImages.length ? (
            <FolderImages
              key={`${selectedFolder.path}-${query}`}
              items={folderImages}
              {...actions}
            />
          ) : (
            <Alert severity="info">当前文件夹没有匹配的图片。</Alert>
          )}
        </Stack>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "repeat(auto-fill, minmax(240px, 1fr))",
            },
            gap: 2,
          }}
        >
          {groups.map(({ folder, count }) => (
            <CatalogCardSlot
              key={folder.path}
              cardKey={folder.path}
              kind="media"
              label={`查看文件夹 ${folderName(folder)}`}
              onSelect={() => selectFolder(folder.path)}
            >
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  transition: "border-color 180ms, background-color 180ms",
                  "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
                  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                }}
              >
                <CardActionArea
                  onClick={() => selectFolder(folder.path)}
                  aria-label={`查看文件夹 ${folderName(folder)}`}
                  title={folder.path}
                  sx={{ height: "100%" }}
                >
                  <Stack spacing={1} sx={{ p: 2, height: "100%", boxSizing: "border-box" }}>
                    <Stack
                      direction="row"
                      sx={{ alignItems: "center", justifyContent: "space-between" }}
                    >
                      <FolderOutlined sx={{ fontSize: 28, color: "primary.main" }} />
                      <Chip size="small" label={`${count} 张`} />
                    </Stack>
                    <Typography
                      sx={{
                        fontWeight: 600,
                        overflowWrap: "anywhere",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {folderName(folder)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        mt: "auto !important",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {folder.path}
                    </Typography>
                  </Stack>
                </CardActionArea>
              </Card>
            </CatalogCardSlot>
          ))}
        </Box>
      )}
      {!selectedFolder && !groups.length && <Alert severity="info">没有匹配的图片或文件夹。</Alert>}
    </Stack>
  );
}
function FolderImages({ items, readOnly, onCopy, onDelete }: Actions & { items: ProjectImage[] }) {
  const [page, setPage] = useState(1);
  const pages = Math.ceil(items.length / 12);
  const current = Math.min(page, pages);
  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        {items.slice((current - 1) * 12, current * 12).map((item) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 3 }} key={item.path}>
            <Card variant="outlined" data-page-motion="tile">
              <ImagePreview item={item} />
              <CardContent>
                <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                  {item.path.split(/[\\/]/).at(-1)}
                </Typography>
                <Stack
                  direction="row"
                  sx={{ mt: 1, justifyContent: "space-between", alignItems: "center" }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {item.size < 1048576
                      ? `${(item.size / 1024).toFixed(1)} KB`
                      : `${(item.size / 1048576).toFixed(1)} MB`}
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
                  onClick={() => onCopy(item)}
                >
                  {item.publicReference ? "复制引用" : "复制路径"}
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutline />}
                  disabled={readOnly || Boolean(item.referencedBy.length)}
                  onClick={() => onDelete(item)}
                >
                  删除
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      {pages > 1 && (
        <Pagination
          count={pages}
          page={current}
          onChange={(_, next) => setPage(next)}
          sx={{ alignSelf: "center" }}
        />
      )}
    </Stack>
  );
}
function ImagePreview({ item }: { item: ProjectImage }) {
  const [failed, setFailed] = useState(false);
  return (
    <Box
      sx={{
        height: 180,
        bgcolor: "action.hover",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {failed ? (
        <Typography color="text.secondary" variant="body2">
          当前格式无法预览
        </Typography>
      ) : (
        <Box
          component="img"
          alt=""
          loading="lazy"
          src={`/api/media/file?scope=project&path=${encodeURIComponent(item.path)}`}
          onError={() => setFailed(true)}
          sx={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      )}
    </Box>
  );
}
