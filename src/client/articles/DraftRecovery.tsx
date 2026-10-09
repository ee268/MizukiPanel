import { useCallback, useEffect, useState } from "react";
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
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ArticleRecord, ArticleListItem } from "../types";
import { api } from "../api";
import { draftError, IndexedDraftStore, notifyDraft, type LocalDraft } from "./local-drafts";

function DraftDetails({
  row,
  article,
  onClose,
  onReviewed,
}: {
  row: LocalDraft | null;
  article: ArticleRecord | null;
  onClose: () => void;
  onReviewed?: (row: LocalDraft, version: string) => void;
}) {
  const [current, setCurrent] = useState(article);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!row) return;
    let active = true;
    setCurrent(null);
    setError("");
    void api<{ article: ArticleRecord; projectKey: string }>(
      `/api/article?id=${encodeURIComponent(row.articleId)}`,
    )
      .then((data) => {
        if (!active) return;
        if (data.projectKey !== row.projectKey)
          throw new Error("当前项目已变化，未使用其他项目的文章比较。");
        setCurrent(data.article);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [row?.key, row?.revision]);
  if (!row) return null;
  const close = () => {
    if (current) onReviewed?.(row, current.version);
    onClose();
  };
  return (
    <Dialog open onClose={close} fullWidth maxWidth="xl">
      <DialogTitle>草稿差异 · {row.articleId}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {error && <Alert severity="warning">{error}</Alert>}
          <Alert severity={current?.version !== row.baseVersion ? "warning" : "info"}>
            {current?.version !== row.baseVersion
              ? "当前磁盘版本与草稿基线不同，或文件尚未读取。恢复不会自动合并，也不会写入磁盘。"
              : "磁盘版本与草稿基线相同。恢复仅填入编辑区，之后可手动保存。"}
          </Alert>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3,minmax(0,1fr))" },
              gap: 2,
            }}
          >
            {[
              { label: "草稿基线", source: row.baseSource, fields: row.baseFrontmatter },
              {
                label: "当前磁盘",
                source: current?.source ?? "正在读取，或当前文件不可用。",
                fields: current?.frontmatter ?? [],
              },
              {
                label: "本地草稿",
                source: row.source,
                fields: row.frontmatter.map(({ rowId, ...entry }) => entry),
              },
            ].map((value) => (
              <Stack key={value.label} spacing={2}>
                <TextField
                  label={value.label + "源码"}
                  value={value.source}
                  multiline
                  minRows={12}
                  maxRows={20}
                  fullWidth
                  slotProps={{
                    input: { readOnly: true, sx: { fontFamily: "var(--mizuki-panel-font-mono)" } },
                  }}
                />
                <TextField
                  label={value.label + "字段"}
                  value={JSON.stringify(value.fields, null, 2)}
                  multiline
                  minRows={5}
                  maxRows={12}
                  fullWidth
                  slotProps={{ input: { readOnly: true } }}
                />
              </Stack>
            ))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}
function DiscardDialog({
  row,
  onClose,
  onDiscard,
}: {
  row: LocalDraft | null;
  onClose: () => void;
  onDiscard: (row: LocalDraft) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={Boolean(row)} onClose={busy ? undefined : onClose}>
      <DialogTitle>丢弃本地恢复副本</DialogTitle>
      <DialogContent>
        仅删除 {row?.articleId} 在 {row && new Date(row.updatedAt).toLocaleString()}{" "}
        保存的这一份副本；不修改磁盘文章或当前编辑内容。其他会话的副本保留。
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          取消
        </Button>
        <Button
          disabled={busy}
          color="error"
          onClick={() => {
            if (!row) return;
            setBusy(true);
            void onDiscard(row).finally(() => {
              setBusy(false);
              onClose();
            });
          }}
        >
          确认丢弃
        </Button>
      </DialogActions>
    </Dialog>
  );
}
export function DraftRecovery({
  entries,
  article,
  dirty,
  onRestore,
  onDiscard,
}: {
  entries: LocalDraft[];
  article: ArticleRecord;
  dirty: boolean;
  onRestore: (row: LocalDraft, reviewedVersion?: string) => Promise<void>;
  onDiscard: (row: LocalDraft) => Promise<void>;
}) {
  const [deferred, setDeferred] = useState(false);
  const [view, setView] = useState<LocalDraft | null>(null);
  const [remove, setRemove] = useState<LocalDraft | null>(null);
  const [reviewed, setReviewed] = useState<Record<string, string>>({});
  if (!entries.length) return null;
  return (
    <>
      <Alert
        severity="warning"
        action={
          <Button onClick={() => setDeferred((value) => !value)}>
            {deferred ? "显示恢复副本" : "暂不处理"}
          </Button>
        }
      >
        发现 {entries.length} 份本地恢复副本，来自先前或其他编辑会话。
        {dirty
          ? "当前已有未保存修改，请先保存后再恢复其他副本。"
          : "请选择要恢复的版本；磁盘文章保持不变。"}
      </Alert>
      {!deferred && (
        <List>
          {entries.map((row) => (
            <ListItem key={row.key} divider sx={{ display: "block" }}>
              <Stack spacing={1}>
                <Typography variant="body2">
                  {new Date(row.updatedAt).toLocaleString()} · 会话 {row.sessionId.slice(0, 8)} ·{" "}
                  {row.baseVersion === article.version
                    ? "同一磁盘基线"
                    : "磁盘版本已变化，先比对差异"}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                  <Button onClick={() => setView(row)}>查看差异</Button>
                  <Button
                    disabled={dirty}
                    onClick={() => void onRestore(row, reviewed[row.key + row.revision])}
                  >
                    恢复到编辑区
                  </Button>
                  <Button color="error" onClick={() => setRemove(row)}>
                    丢弃
                  </Button>
                </Stack>
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
      <DraftDetails
        row={view}
        article={article}
        onReviewed={(row, version) =>
          setReviewed((values) => ({ ...values, [row.key + row.revision]: version }))
        }
        onClose={() => setView(null)}
      />
      <DiscardDialog row={remove} onClose={() => setRemove(null)} onDiscard={onDiscard} />
    </>
  );
}
export function DraftLibrary({
  projectKey,
  article,
  articles,
  onOpenArticle,
}: {
  projectKey: string;
  article: ArticleRecord | null;
  articles: ArticleListItem[];
  onOpenArticle: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LocalDraft[]>([]);
  const [error, setError] = useState("");
  const [view, setView] = useState<LocalDraft | null>(null);
  const [remove, setRemove] = useState<LocalDraft | null>(null);
  const refresh = useCallback(async () => {
    if (!projectKey) return;
    try {
      const data = await new IndexedDraftStore().list(projectKey);
      setEntries(data.entries);
      setError(data.unreadable ? "无法识别的草稿仍保留，当前未列出。" : "");
    } catch (cause) {
      setError(draftError(cause));
    }
  }, [projectKey]);
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);
  const discard = async (row: LocalDraft) => {
    try {
      await new IndexedDraftStore().remove(row.key, row.revision);
      notifyDraft({
        projectKey: row.projectKey,
        articleId: row.articleId,
        key: row.key,
        type: "discard",
      });
      await refresh();
    } catch (cause) {
      setError(draftError(cause));
    }
  };
  function download(row: LocalDraft) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(row, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = row.articleId.replace(/[\\/]/g, "-") + ".recovery.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Box>
      <Button disabled={!projectKey} onClick={() => setOpen(true)}>
        本地草稿列表
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>当前项目的本地草稿</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2">
              按会话分别保留。文章被删除或暂不可读取时仍可查看和下载副本，不会自动重建文件。
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <Button sx={{ alignSelf: "flex-start" }} onClick={() => void refresh()}>
              刷新列表
            </Button>
            {!entries.length && (
              <Typography color="text.secondary">当前项目没有可识别的草稿。</Typography>
            )}
            <List>
              {entries.map((row) => {
                const exists = articles.some((item) => item.id === row.articleId) && !row.missing;
                return (
                  <ListItem key={row.key} divider sx={{ display: "block" }}>
                    <Stack spacing={1}>
                      <Typography>{row.articleId}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(row.updatedAt).toLocaleString()} · 会话{" "}
                        {row.sessionId.slice(0, 8)}
                        {row.missing
                          ? " · 原文件不可用或已删除"
                          : !exists
                            ? " · 当前列表未包含此路径，可尝试打开"
                            : ""}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                        <Button
                          disabled={Boolean(row.missing)}
                          onClick={() => {
                            void onOpenArticle(row.articleId);
                            setOpen(false);
                          }}
                        >
                          打开文章
                        </Button>
                        <Button onClick={() => setView(row)}>查看差异</Button>
                        <Button onClick={() => download(row)}>下载恢复副本</Button>
                        <Button color="error" onClick={() => setRemove(row)}>
                          丢弃
                        </Button>
                      </Stack>
                    </Stack>
                  </ListItem>
                );
              })}
            </List>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
      <DraftDetails
        row={view}
        article={article?.id === view?.articleId ? article : null}
        onClose={() => setView(null)}
      />
      <DiscardDialog row={remove} onClose={() => setRemove(null)} onDiscard={discard} />
    </Box>
  );
}
