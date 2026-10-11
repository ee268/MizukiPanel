import CommitOutlined from "@mui/icons-material/CommitOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import ClearOutlined from "@mui/icons-material/ClearOutlined";
import { useRef } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  Pagination,
  Stack,
  Typography,
  TextField,
} from "@mui/material";
import { ContentLoading } from "../components/ContentLoading";
import type { PublishHistory as History } from "../types";

interface HistoryProps {
  history: History | null;
  loading: boolean;
  error: string;
  page: number;
  onPage: (page: number) => void;
  onCommit: (sha: string) => void;
}
export function PublishHistory({
  search,
  query,
  onSearchChange,
  onSearch,
  onClearSearch,
  ...results
}: HistoryProps & {
  search: string;
  query: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
}) {
  const composing = useRef(false);
  return (
    <Box>
      <Stack
        component="form"
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        onSubmit={(event) => {
          event.preventDefault();
          if (!composing.current) onSearch();
        }}
        sx={{ p: 2 }}
      >
        <TextField
          fullWidth
          size="small"
          label="查询提交历史"
          placeholder="提交说明、作者、邮箱或提交 ID"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (composing.current || event.nativeEvent.isComposing))
              event.preventDefault();
          }}
          slotProps={{
            htmlInput: { maxLength: 200 },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined />
                </InputAdornment>
              ),
              endAdornment:
                search || query ? (
                  <InputAdornment position="end">
                    <IconButton size="small" aria-label="清除历史查询" onClick={onClearSearch}>
                      <ClearOutlined />
                    </IconButton>
                  </InputAdornment>
                ) : null,
            },
          }}
        />
        <Button type="submit" variant="outlined" sx={{ flexShrink: 0 }}>
          查询
        </Button>
      </Stack>
      <HistoryResults {...results} />
    </Box>
  );
}
function HistoryResults({ history, loading, error, page, onPage, onCommit }: HistoryProps) {
  if (error)
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  if (loading || !history)
    return (
      <Box sx={{ p: 2 }}>
        <ContentLoading
          heading="正在展开提交历史"
          description="正在读取当前分支的过往提交"
          size="compact"
        />
      </Box>
    );
  if (!history.commits.length)
    return (
      <Typography sx={{ p: 3 }} color="text.secondary">
        {history.query ? "没有匹配的提交记录，请调整或清除查询条件。" : "当前分支还没有提交记录。"}
      </Typography>
    );
  return (
    <Box>
      <Stack
        direction="row"
        sx={{ p: 2, justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}
      >
        <Typography variant="h6">提交历史</Typography>
        <Typography color="text.secondary">
          {history.query
            ? `查询结果 · 共 ${history.total} 条`
            : `当前分支 · 共 ${history.total} 条`}
        </Typography>
      </Stack>
      <List disablePadding sx={{ maxHeight: { xs: 440, lg: 560 }, overflow: "auto" }}>
        {history.commits.map((commit) => (
          <ListItemButton
            key={commit.sha}
            onClick={() => onCommit(commit.sha)}
            sx={{
              px: 2,
              py: 1.5,
              gap: 1.5,
              alignItems: "flex-start",
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            <CommitOutlined color="primary" sx={{ mt: 0.5, flexShrink: 0 }} />
            <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 650, overflowWrap: "anywhere" }}>
                {commit.subject}
              </Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                <Chip
                  size="small"
                  label={commit.sha.slice(0, 8)}
                  sx={{ fontFamily: "var(--mizuki-panel-font-mono)" }}
                />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {commit.author} · {new Date(commit.date).toLocaleString("zh-CN")}
                </Typography>
              </Stack>
              {commit.refs && (
                <Typography variant="caption" color="primary" sx={{ overflowWrap: "anywhere" }}>
                  {commit.refs}
                </Typography>
              )}
            </Stack>
          </ListItemButton>
        ))}
      </List>
      <Stack sx={{ p: 2, alignItems: "center" }}>
        <Pagination
          size="small"
          count={Math.ceil(history.total / history.pageSize)}
          page={page}
          onChange={(_, next) => onPage(next)}
          aria-label="提交历史分页"
        />
      </Stack>
    </Box>
  );
}
