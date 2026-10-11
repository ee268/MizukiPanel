import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ContentLoading } from "../components/ContentLoading";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import SortOutlined from "@mui/icons-material/SortOutlined";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../api";
import { errorMessage } from "../shared/errors";
import {
  bangumiSearchResultLimit,
  bangumiSearchSorts,
  sortBangumiAnime,
  type BangumiAnime,
  type BangumiSearchPage,
  type BangumiSearchSort,
} from "../../shared/bangumi-search";
import { BangumiCover } from "./BangumiCover";

const displayPageSize = 10;

export function BangumiSearchDialog({
  onClose,
  onInsert,
  disabled,
}: {
  onClose: () => void;
  onInsert: (id: number) => void;
  disabled: boolean;
}) {
  const [keyword, setKeyword] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [result, setResult] = useState<{
    total: number;
    data: BangumiAnime[];
    limited: boolean;
  } | null>(null);
  const [sort, setSort] = useState<BangumiSearchSort>("date-desc");
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);
  const [page, setPage] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const composing = useRef(false);
  const dialogContent = useRef<HTMLDivElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  const sorted = useMemo(() => sortBangumiAnime(result?.data ?? [], sort), [result, sort]);
  const pageItems = sorted.slice(page * displayPageSize, (page + 1) * displayPageSize);
  const sortLabel = bangumiSearchSorts.find((option) => option.value === sort)!.label;

  async function search(query: string) {
    if (!query.trim() || composing.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setResult(null);
    setPage(0);
    setLoadedCount(0);
    setSubmitted(query.trim());
    try {
      const data: BangumiAnime[] = [];
      const seen = new Set<number>();
      let offset = 0;
      let total = 0;
      let fullPage = false;
      do {
        const response = await api<BangumiSearchPage>(
          `/api/feature/anime-search?${new URLSearchParams({ keyword: query.trim(), offset: String(offset) })}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        total = Math.max(total, response.total);
        for (const item of response.data) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          data.push(item);
        }
        setLoadedCount(data.length);
        offset += response.limit;
        fullPage = response.data.length === response.limit;
      } while (fullPage && offset < bangumiSearchResultLimit);
      if (!controller.signal.aborted)
        setResult({ total, data, limited: fullPage && offset >= bangumiSearchResultLimit });
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorMessage(cause, "动画搜索失败"));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void search(keyword);
  }
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>搜索动画</DialogTitle>
      <DialogContent ref={dialogContent} dividers>
        <Stack component="form" onSubmit={submit} direction="row" spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="动画名称"
            placeholder="输入中文名或原名"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
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
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<SearchOutlined />}
            disabled={!keyword.trim()}
            sx={{ flexShrink: 0 }}
          >
            搜索
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          选择条目，将 {"{% id %}"} 插入当前光标位置；选中文字时替换选区。插入后请保存季度文件。
        </Typography>
        <Stack
          direction="row"
          sx={{
            mb: 2,
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {result ? `“${submitted}” · 约 ${result.total} 个结果` : "搜索结果"}
          </Typography>
          <Button
            startIcon={<SortOutlined />}
            aria-haspopup="menu"
            aria-expanded={Boolean(sortAnchor)}
            aria-controls={sortAnchor ? "bangumi-sort-menu" : undefined}
            onClick={(event) => setSortAnchor(event.currentTarget)}
          >
            排序：{sortLabel}
          </Button>
        </Stack>
        <Menu
          id="bangumi-sort-menu"
          anchorEl={sortAnchor}
          open={Boolean(sortAnchor)}
          onClose={() => setSortAnchor(null)}
        >
          {bangumiSearchSorts.map((option) => (
            <MenuItem
              key={option.value}
              selected={sort === option.value}
              onClick={() => {
                setSort(option.value);
                setPage(0);
                if (dialogContent.current) dialogContent.current.scrollTop = 0;
                setSortAnchor(null);
              }}
            >
              {option.label}
            </MenuItem>
          ))}
        </Menu>
        <Box aria-busy={busy} aria-live="polite" sx={{ minHeight: 240 }}>
          {busy && (
            <ContentLoading
              heading="正在展开动画搜索"
              description={loadedCount ? `正在读取搜索结果…已加载 ${loadedCount} 项` : "正在搜索…"}
              kind="media"
              size="compact"
            />
          )}
          {error && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" onClick={() => void search(submitted)}>
                  重试
                </Button>
              }
            >
              {error}
            </Alert>
          )}
          {!busy && !error && !result && (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              输入动画名称后开始搜索。
            </Typography>
          )}
          {result && (
            <>
              {result.limited && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  结果较多，本次已加载 {result.data.length} 项，可使用更完整的动画名称缩小范围。
                </Alert>
              )}
              {result.data.length === 0 && (
                <Alert severity="info">没有更多匹配的动画，请尝试其他名称或返回上一页。</Alert>
              )}
              <List disablePadding>
                {pageItems.map((item, index) => (
                  <ListItem
                    key={item.id}
                    divider={index < pageItems.length - 1}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "80px minmax(0, 1fr)",
                        sm: "96px minmax(0, 1fr) auto",
                      },
                      columnGap: 2,
                      rowGap: 1,
                      py: 2,
                      px: 0,
                      alignItems: "center",
                    }}
                  >
                    <Box sx={{ gridRow: { xs: "1 / span 2", sm: "auto" } }}>
                      <BangumiCover
                        src={item.image}
                        title={item.nameCn || item.name || String(item.id)}
                      />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                        {item.nameCn || item.name || `条目 ${item.id}`}
                      </Typography>
                      {item.nameCn && item.name && item.nameCn !== item.name && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ overflowWrap: "anywhere" }}
                        >
                          {item.name}
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary">
                        ID {item.id}
                        {` · ${item.date || "日期未提供"}`}
                        {item.score ? ` · 评分 ${item.score}` : ""}
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddOutlined />}
                      disabled={disabled}
                      aria-label={`插入 ${item.nameCn || item.name || item.id}（${item.id}）`}
                      onClick={() => onInsert(item.id)}
                      sx={{
                        justifySelf: "start",
                        gridColumn: { xs: 2, sm: 3 },
                        gridRow: { xs: 2, sm: 1 },
                      }}
                    >
                      插入
                    </Button>
                  </ListItem>
                ))}
              </List>
              <Stack
                direction="row"
                spacing={2}
                sx={{ mt: 2, alignItems: "center", justifyContent: "center" }}
              >
                <Button
                  disabled={page === 0}
                  onClick={() => {
                    setPage((previous) => previous - 1);
                    if (dialogContent.current) dialogContent.current.scrollTop = 0;
                  }}
                >
                  上一页
                </Button>
                <Typography variant="body2">
                  第 {page + 1} / {Math.max(1, Math.ceil(sorted.length / displayPageSize))} 页
                </Typography>
                <Button
                  disabled={(page + 1) * displayPageSize >= sorted.length}
                  onClick={() => {
                    setPage((previous) => previous + 1);
                    if (dialogContent.current) dialogContent.current.scrollTop = 0;
                  }}
                >
                  下一页
                </Button>
              </Stack>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}
