import { useEffect, useRef, useState, type FormEvent } from "react";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../api";
import { errorMessage } from "../shared/errors";
import type { BangumiSearchPage } from "../../shared/bangumi-search";

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
  const [result, setResult] = useState<BangumiSearchPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const requestedOffset = useRef(0);
  const composing = useRef(false);
  useEffect(() => () => request.current?.abort(), []);

  async function search(query: string, offset = 0) {
    if (!query.trim() || composing.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    requestedOffset.current = offset;
    setBusy(true);
    setError("");
    setResult(null);
    setSubmitted(query.trim());
    try {
      const page = await api<BangumiSearchPage>(
        `/api/feature/anime-search?${new URLSearchParams({ keyword: query.trim(), offset: String(offset) })}`,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) setResult(page);
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
      <DialogContent dividers>
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
        <Box aria-busy={busy} aria-live="polite" sx={{ minHeight: 240 }}>
          {busy && (
            <>
              <LinearProgress />
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ p: 3, alignItems: "center", justifyContent: "center" }}
              >
                <CircularProgress size={20} />
                <Typography color="text.secondary">正在搜索…</Typography>
              </Stack>
            </>
          )}
          {error && (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  onClick={() => void search(submitted, requestedOffset.current)}
                >
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
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                “{submitted}” · 约 {result.total} 个结果
              </Typography>
              {result.data.length === 0 && (
                <Alert severity="info">没有更多匹配的动画，请尝试其他名称或返回上一页。</Alert>
              )}
              <List disablePadding>
                {result.data.map((item, index) => (
                  <ListItem
                    key={item.id}
                    divider={index < result.data.length - 1}
                    sx={{ gap: 2, px: 0, alignItems: "center" }}
                  >
                    <Avatar
                      variant="rounded"
                      src={item.image || undefined}
                      alt=""
                      sx={{
                        width: 52,
                        height: 72,
                        flexShrink: 0,
                        bgcolor: "action.hover",
                        color: "text.secondary",
                      }}
                    >
                      <SearchOutlined />
                    </Avatar>
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
                        {item.date ? ` · ${item.date}` : ""}
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
                      sx={{ flexShrink: 0 }}
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
                  disabled={result.offset === 0}
                  onClick={() => void search(submitted, Math.max(0, result.offset - result.limit))}
                >
                  上一页
                </Button>
                <Typography variant="body2">
                  第 {Math.floor(result.offset / result.limit) + 1} 页
                </Typography>
                <Button
                  disabled={result.data.length < result.limit}
                  onClick={() => void search(submitted, result.offset + result.limit)}
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
