import SearchOutlined from "@mui/icons-material/SearchOutlined";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ArticleListItem } from "../types";
import { articleImageUrl } from "./article-image";
import { LazyArticleCover } from "./LazyArticleCover";
import type { ArticleFilter } from "./types";

const filterOptions: Array<{ value: ArticleFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "published", label: "已发布" },
  { value: "draft", label: "草稿" },
  { value: "invalid", label: "需要修复" },
];

interface ArticleListProps {
  articles: ArticleListItem[];
  query: string;
  filter: ArticleFilter;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: ArticleFilter) => void;
  onSelect: (id: string) => void;
}

export function ArticleList({
  articles,
  query,
  filter,
  onQueryChange,
  onFilterChange,
  onSelect,
}: ArticleListProps) {
  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            placeholder="搜索标题、简介或路径"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            label="文章状态"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value as ArticleFilter)}
            sx={{ minWidth: { md: 180 } }}
          >
            {filterOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      {articles.length ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(3, minmax(0, 1fr))",
            },
            gap: 2,
          }}
        >
          {articles.map((item) => {
            const imageUrl = articleImageUrl(item.image, item.id);

            return (
              <Card key={item.id} variant="outlined" sx={{ minWidth: 0 }}>
                <CardActionArea onClick={() => onSelect(item.id)} sx={{ height: "100%" }}>
                  {imageUrl && <LazyArticleCover src={imageUrl} title={item.title} />}
                  <CardContent>
                    <Stack spacing={1.25}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                        <Typography variant="h6" sx={{ flex: 1, minWidth: 0 }}>
                          {item.title}
                        </Typography>
                        {item.error ? (
                          <Chip size="small" color="error" label="异常" />
                        ) : item.draft ? (
                          <Chip size="small" color="warning" label="草稿" />
                        ) : null}
                      </Stack>
                      <Typography
                        color="text.secondary"
                        sx={{
                          minHeight: "3em",
                          display: "-webkit-box",
                          overflow: "hidden",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                        }}
                      >
                        {item.description || "暂无文章简介"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.published || "未设置发布日期"}
                      </Typography>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="h6">没有符合条件的文章</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            请调整搜索内容或文章状态筛选。
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}
