import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import { Box, Button, Grid, MenuItem, Paper, TextField, Typography } from "@mui/material";
import type { FormEvent } from "react";
import type { MediaScope } from "./types";

interface MediaUploadProps {
  scope: MediaScope;
  articles: Array<{ id: string; title: string }>;
  articleId: string;
  folder: string;
  file: File | null;
  busy: boolean;
  readOnly: boolean;
  onScopeChange: (scope: MediaScope) => void;
  onArticleChange: (id: string) => void;
  onFolderChange: (folder: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent) => void;
}

export function MediaUpload({
  scope,
  articles,
  articleId,
  folder,
  file,
  busy,
  readOnly,
  onScopeChange,
  onArticleChange,
  onFolderChange,
  onFileChange,
  onSubmit,
}: MediaUploadProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        上传图片
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        支持 PNG、JPEG、GIF、WebP、AVIF，最大 20 MB；不会覆盖同名文件。
      </Typography>
      <Box component="form" onSubmit={onSubmit}>
        <Grid container spacing={2} sx={{ alignItems: "center" }}>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              select
              label="存储位置"
              value={scope}
              onChange={(event) => onScopeChange(event.target.value as MediaScope)}
              fullWidth
            >
              <MenuItem value="public">公共图片 /images/</MenuItem>
              <MenuItem value="article">文章相对资源</MenuItem>
            </TextField>
          </Grid>
          {scope === "article" && (
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                select
                label="所属文章"
                value={articleId}
                onChange={(event) => onArticleChange(event.target.value)}
                fullWidth
                required
              >
                {articles.map((article) => (
                  <MenuItem value={article.id} key={article.id}>
                    {article.title} · {article.id}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="子目录（可留空）"
              value={folder}
              onChange={(event) => onFolderChange(event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadOutlined />}
              fullWidth
              sx={{ height: 40, justifyContent: "flex-start" }}
            >
              {file?.name ?? "选择图片"}
              <input
                hidden
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              />
            </Button>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={!file || busy || readOnly || (scope === "article" && !articleId)}
              fullWidth
            >
              上传
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
}
