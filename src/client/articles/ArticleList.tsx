import SearchOutlined from "@mui/icons-material/SearchOutlined";
import {
  Chip,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ArticleListItem } from "../types";
import type { ArticleFilter } from "./types";

const filterOptions: Array<{ value: ArticleFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "published", label: "已发布" },
  { value: "draft", label: "草稿" },
  { value: "invalid", label: "需要修复" },
];

interface ArticleListProps {
  articles: ArticleListItem[];
  selectedId: string | null;
  query: string;
  filter: ArticleFilter;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: ArticleFilter) => void;
  onSelect: (id: string) => void;
}

export function ArticleList({
  articles,
  selectedId,
  query,
  filter,
  onQueryChange,
  onFilterChange,
  onSelect,
}: ArticleListProps) {
  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <TextField
          placeholder="搜索标题或路径"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
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
        >
          {filterOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Divider />
      <List disablePadding sx={{ maxHeight: "calc(100vh - 280px)", overflow: "auto" }}>
        {articles.map((item) => (
          <ListItemButton
            key={item.id}
            selected={selectedId === item.id}
            onClick={() => onSelect(item.id)}
            alignItems="flex-start"
            sx={{ py: 1.5 }}
          >
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 650 }}>
                    {item.title}
                  </Typography>
                  {item.error ? (
                    <Chip size="small" color="error" label="异常" />
                  ) : item.draft ? (
                    <Chip size="small" color="warning" label="草稿" />
                  ) : null}
                </Stack>
              }
              secondary={
                <>
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ display: "block", fontFamily: "monospace", overflowWrap: "anywhere" }}
                  >
                    {item.id}
                  </Typography>
                  {item.published}
                </>
              }
            />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
}
