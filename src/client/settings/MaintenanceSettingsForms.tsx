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
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { ArchiveInventory, ArchiveItem, MaintenancePreview } from "../../shared/maintenance";
import { api, json } from "../api";
import { ScopedCard } from "./WorkspaceSettingsForms";
import type { useScopedSettings } from "./useScopedSettings";
import { SettingsModule } from "./SettingsModule";
import { ContentLoading } from "../components/ContentLoading";
export const archiveSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KiB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
function ArchiveRow({ item, children }: { item: ArchiveItem; children?: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Stack spacing={1}>
        <Typography sx={{ overflowWrap: "anywhere" }}>{item.originalPath}</Typography>
        <Typography variant="body2" color="text.secondary">
          {item.kind === "backup" ? "保存备份" : "回收项"} · {item.projectName} ·{" "}
          {new Date(item.createdAt).toLocaleString()} · {archiveSize(item.bytes)}
        </Typography>
        {(item.reason || item.protected) && (
          <Typography variant="body2" color="text.secondary">
            {item.reason || "最新恢复点，保留并禁止清理。"}
          </Typography>
        )}
        {children}
      </Stack>
    </Paper>
  );
}
export function MaintenanceSettingsForms({
  controller,
  active,
  revision,
  disabled,
  onRestored,
}: {
  controller: ReturnType<typeof useScopedSettings>;
  active: boolean;
  revision: unknown;
  disabled: boolean;
  onRestored: () => void;
}) {
  const [inventory, setInventory] = useState<ArchiveInventory | null>(null);
  const [inventoryVisible, setInventoryVisible] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [kind, setKind] = useState("all");
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
    if (!active || !inventoryVisible) return;
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
  }, [active, revision, inventoryVisible]);
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
        (kind === "all" || item.kind === kind) &&
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
  return (
    <Stack spacing={3}>
      <ScopedCard title="备份保留规则" controller={controller}>
        <Stack spacing={2}>
          <Alert severity="info">
            不会自动清理。以下规则只用于手动清理预览；每个原路径的最新备份和回收项始终保留，运行任务与无法确认归属的数据也受保护。
          </Alert>
          <FormControlLabel
            label="启用手动清理规则"
            control={
              <Switch
                checked={controller.value.enabled === true}
                onChange={(_, enabled) => controller.change({ enabled })}
              />
            }
          />
          <TextField
            label="保留天数"
            type="number"
            value={controller.value.days}
            onChange={(event) => controller.change({ days: Number(event.target.value) })}
            helperText="1—3650 天。早于保留期限的旧恢复项可进入清理预览。"
          />
          <TextField
            label="每个原路径保留数量"
            type="number"
            value={controller.value.count}
            onChange={(event) => controller.change({ count: Number(event.target.value) })}
            helperText="1—1000 个。超出数量的旧恢复项也可进入预览。"
          />
        </Stack>
      </ScopedCard>
      <SettingsModule
        label="备份与回收"
        estimatedHeight={620}
        onVisibilityChange={setInventoryVisible}
      >
        <Paper
          variant="outlined"
          component="section"
          aria-label="备份与回收"
          sx={{ p: { xs: 2, sm: 3 } }}
        >
          <Stack spacing={2}>
            <Typography variant="h6" component="h3">
              备份与回收
            </Typography>
            {inventory && (
              <Typography color="text.secondary">
                共 {inventory.totals.count} 项 · 备份 {archiveSize(inventory.totals.backup)} · 回收{" "}
                {archiveSize(inventory.totals.trash)}
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
                heading="正在展开备份与回收"
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
                    (inventory?.items ?? [])
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
                select
                label="恢复项类型"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setLimit(20);
                }}
                fullWidth
              >
                <MenuItem value="all">全部类型</MenuItem>
                <MenuItem value="backup">保存备份</MenuItem>
                <MenuItem value="trash">回收项</MenuItem>
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
                      json("POST"),
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
      </SettingsModule>
      <Dialog
        open={Boolean(preview)}
        onClose={() => {
          if (!busy) setPreview(null);
        }}
        fullWidth
        maxWidth="md"
        aria-labelledby="maintenance-preview-title"
      >
        <DialogTitle id="maintenance-preview-title">
          {preview?.kind === "restore" ? "确认恢复" : "手动清理预览"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              {preview?.kind === "restore"
                ? `将恢复到原路径 ${preview.destination}。现有文件会先建立备份；回收项只能恢复到不存在的路径。`
                : `全部项目与本机共 ${preview?.items.length ?? 0} 项可清理，共 ${archiveSize(preview?.bytes ?? 0)}。仅删除明确勾选的恢复副本，不删除正文、项目文件或本地草稿。`}
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
