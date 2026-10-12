import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ArchiveInventory, ArchiveItem, MaintenancePreview } from "../../shared/maintenance";
import { api, json } from "../api";
import { ArchiveRow, archiveSize } from "./ArchiveRow";
import { ContentLoading } from "../components/ContentLoading";
export function ArchiveManagementPanel({
  kind,
  active,
  revision,
  disabled,
  onRestored,
  onChanged,
}: {
  kind: ArchiveItem["kind"];
  active: boolean;
  revision: unknown;
  disabled: boolean;
  onRestored: () => void;
  onChanged: () => void;
}) {
  const [inventory, setInventory] = useState<ArchiveInventory | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(20);
  const [preview, setPreview] = useState<
    (MaintenancePreview & { kind: "restore" | "cleanup" }) | null
  >(null);
  const [selected, setSelected] = useState<string[]>([]);
  async function refresh() {
    setInventory(await api<ArchiveInventory>("/api/maintenance"));
  }
  useEffect(() => {
    if (!active) return;
    const abort = new AbortController();
    setError("");
    setPreview(null);
    void api<ArchiveInventory>("/api/maintenance", { signal: abort.signal })
      .then((value) => {
        if (!abort.signal.aborted) setInventory(value);
      })
      .catch((cause) => {
        if (!abort.signal.aborted) setError(cause.message);
      });
    return () => abort.abort();
  }, [active, revision]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible =
    inventory?.items.filter(
      (item) =>
        item.kind === kind &&
        (filter === "all" ||
          (filter.startsWith("owned:") && item.projectKey === filter.slice(6)) ||
          (filter === "project" &&
            item.projectKey === inventory.projectKey &&
            item.projectKey !== null) ||
          (filter === "machine" &&
            ["settings", "workspace"].includes(item.domain) &&
            item.projectKey === null) ||
          (filter === "unknown" && item.domain === "unknown")) &&
        item.originalPath.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  const locked = disabled || busy;
  const title = kind === "backup" ? "备份管理" : "回收站";
  const ownedItems = inventory?.items.filter((item) => item.kind === kind) ?? [];
  return (
    <Stack spacing={3}>
      <Paper variant="outlined" component="section" aria-label={title} sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <Typography variant="h6" component="h3">
            {title}
          </Typography>
          {inventory && (
            <Typography color="text.secondary">
              共 {ownedItems.length} 项 · 占用{" "}
              {archiveSize(ownedItems.reduce((bytes, item) => bytes + item.bytes, 0))}
            </Typography>
          )}
          {inventory?.warnings.map((warning) => (
            <Alert severity="warning" key={warning}>
              {warning}
            </Alert>
          ))}
          {error && <Alert severity="error">{error}</Alert>}
          {!inventory && !error && (
            <ContentLoading
              heading={`正在展开${title}`}
              description="正在读取可用恢复项"
              kind="settings"
              size="compact"
            />
          )}
          {notice && <Alert severity="success">{notice}</Alert>}
          {disabled && <Alert severity="info">请先保存或取消设置修改，再执行恢复或清理。</Alert>}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              label="归属筛选"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setLimit(20);
              }}
              fullWidth
            >
              <MenuItem value="all">全部项目与本机</MenuItem>
              <MenuItem value="project" disabled={!inventory?.projectKey}>
                当前项目
              </MenuItem>
              <MenuItem value="machine">本机设置</MenuItem>
              <MenuItem value="unknown">归属未知</MenuItem>
              {[
                ...new Map(
                  ownedItems
                    .filter((item) => item.projectKey)
                    .map((item) => [item.projectKey!, item.projectName]),
                ).entries(),
              ].map(([key, name]) => (
                <MenuItem key={key} value={`owned:${key}`}>
                  {name} · {key.slice(0, 8)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="查找原路径"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(20);
              }}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Button disabled={busy} onClick={() => void run(refresh)}>
              刷新列表
            </Button>
            <Button
              disabled={locked || !inventory}
              onClick={() =>
                void run(async () => {
                  const value = await api<MaintenancePreview>(
                    "/api/maintenance/cleanup-preview",
                    json("POST", { kind }),
                  );
                  setSelected([]);
                  setPreview({ ...value, kind: "cleanup" });
                })
              }
            >
              预览手动清理
            </Button>
          </Stack>
          {inventory && visible.length === 0 && (
            <Typography color="text.secondary">没有符合筛选条件的恢复项。</Typography>
          )}
          {visible.slice(0, limit).map((item) => (
            <ArchiveRow key={item.id} item={item}>
              <Box>
                <Button
                  disabled={locked || !item.restorable}
                  onClick={() =>
                    void run(async () =>
                      setPreview({
                        ...(await api<MaintenancePreview>(
                          "/api/maintenance/restore-preview",
                          json("POST", { id: item.id }),
                        )),
                        kind: "restore",
                      }),
                    )
                  }
                >
                  预览恢复
                </Button>
              </Box>
            </ArchiveRow>
          ))}
          {visible.length > limit && (
            <Button onClick={() => setLimit((value) => value + 20)}>
              显示更多（剩余 {visible.length - limit} 项）
            </Button>
          )}
        </Stack>
      </Paper>
      <Dialog
        open={Boolean(preview)}
        onClose={() => {
          if (!busy) setPreview(null);
        }}
        fullWidth
        maxWidth="md"
        aria-labelledby={`${kind}-maintenance-preview-title`}
      >
        <DialogTitle id={`${kind}-maintenance-preview-title`}>
          {preview?.kind === "restore" ? "确认恢复" : `${title}清理预览`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              {preview?.kind === "restore"
                ? kind === "trash"
                  ? `将恢复回收站内容到原路径 ${preview.destination}。原路径已存在时不会覆盖，回收副本仍保留。`
                  : `将恢复备份到原路径 ${preview.destination}。现有文件会先建立备份。`
                : `${title}中全部项目与本机共 ${preview?.items.length ?? 0} 项可清理，共 ${archiveSize(preview?.bytes ?? 0)}。仅删除明确勾选的恢复副本，不删除正文、项目文件或本地草稿。`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              预览有效至 {preview ? new Date(preview.expiresAt).toLocaleTimeString() : ""}
              。数据、任务或保留设置变化后需重新预览。
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            {preview?.items.length === 0 && <Alert severity="info">没有可清理的旧恢复项。</Alert>}
            {preview?.items.map((item) => (
              <ArchiveRow key={item.id} item={item}>
                {preview.kind === "cleanup" && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        disabled={busy}
                        checked={selected.includes(item.id)}
                        onChange={(_, checked) =>
                          setSelected((ids) =>
                            checked ? [...ids, item.id] : ids.filter((id) => id !== item.id),
                          )
                        }
                      />
                    }
                    label="清理此恢复副本"
                  />
                )}
              </ArchiveRow>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setPreview(null)}>
            取消
          </Button>
          <Button
            variant="contained"
            color={preview?.kind === "cleanup" ? "warning" : "primary"}
            disabled={locked || !preview || (preview.kind === "cleanup" && !selected.length)}
            onClick={() =>
              void run(async () => {
                if (!preview) return;
                if (preview.kind === "restore") {
                  await api("/api/maintenance/restore", json("POST", { token: preview.token }));
                  setNotice("恢复已完成，恢复副本仍保留。");
                  onRestored();
                } else {
                  const result = await api<{ results: { success: boolean; message: string }[] }>(
                    "/api/maintenance/cleanup",
                    json("POST", { token: preview.token, ids: selected }),
                  );
                  const failures = result.results.filter((item) => !item.success);
                  setNotice(`已清理 ${result.results.length - failures.length} 项。`);
                  if (failures.length)
                    setError(`部分清理失败：${failures.map((item) => item.message).join("；")}`);
                }
                setPreview(null);
                await refresh();
                onChanged();
              })
            }
          >
            {preview?.kind === "restore" ? "确认恢复" : "清理选中恢复项"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
