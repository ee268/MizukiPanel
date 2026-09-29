import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import BuildOutlined from "@mui/icons-material/BuildOutlined";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import DifferenceOutlined from "@mui/icons-material/DifferenceOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import RestoreOutlined from "@mui/icons-material/RestoreOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import SyncOutlined from "@mui/icons-material/SyncOutlined";
import { api, json } from "../api";
import type { PublishChange, PublishOperationStatus, PublishOverview } from "../types";

const checkColors = { pass: "success", warning: "warning", error: "error" } as const;
const operationLabels = { validate: "发布校验", sync: "内容同步", build: "站点构建" };

function statusLabel(change: PublishChange): string {
  if (change.status === "??") return "新增";
  if (change.status.includes("D")) return "删除";
  if (change.status.includes("R")) return "重命名";
  if (change.conflict) return "冲突";
  return "修改";
}

export default function PublishPage() {
  const [overview, setOverview] = useState<PublishOverview | null>(null);
  const [operation, setOperation] = useState<PublishOperationStatus | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState("feat(content): publish blog updates");
  const [diffPath, setDiffPath] = useState("");
  const [diff, setDiff] = useState("");
  const [dialog, setDialog] = useState<"push" | "revert" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextOverview, nextOperation] = await Promise.all([
        api<PublishOverview>("/api/publish"),
        api<PublishOperationStatus>("/api/publish/operation"),
      ]);
      setOverview(nextOverview);
      setOperation(nextOperation);
      const available = new Set(
        nextOverview.changes
          .filter((change) => change.managed && !change.conflict)
          .map((change) => change.path),
      );
      setSelected((current) => current.filter((item) => available.has(item)));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发布状态读取失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (operation?.state !== "running") return;
    const timer = window.setInterval(() => void load(), 1200);
    return () => window.clearInterval(timer);
  }, [load, operation?.state]);

  const selectable = useMemo(
    () =>
      overview?.changes.filter((change) => change.managed && !change.conflict && !change.staged) ??
      [],
    [overview],
  );
  const allSelected =
    selectable.length > 0 && selectable.every((change) => selected.includes(change.path));
  const running = operation?.state === "running";

  function toggle(path: string) {
    setSelected((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path],
    );
  }

  async function showDiff(path: string) {
    setDiffPath(path);
    setDiff("");
    setError("");
    try {
      setDiff(
        (await api<{ diff: string }>(`/api/publish/diff?path=${encodeURIComponent(path)}`)).diff,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "差异读取失败");
    }
  }

  async function mutate(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      setNotice(success);
      setDialog(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发布操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    await mutate(
      () => api("/api/publish/commit", json("POST", { paths: selected, message: commitMessage })),
      "所选内容已创建 Git 提交。",
    );
  }

  async function startOperation(kind: "validate" | "sync" | "build") {
    await mutate(
      () => api("/api/publish/operation", json("POST", { kind })),
      `${operationLabels[kind]}已启动，请查看运行日志。`,
    );
  }

  if (!overview && !error)
    return (
      <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );

  const steps =
    overview?.mode === "external"
      ? ["发布前检查", "提交内容", "推送内容仓库", "同步至 Mizuki", "构建站点"]
      : ["发布前检查", "提交内容", "推送 Mizuki", "构建站点"];

  return (
    <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, lg: 3 } }}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Box>
            <Typography variant="h4">发布工作流</Typography>
            <Typography color="text.secondary">
              检查并发布选中的内容变更，随后使用 Mizuki 完成真实构建。
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshOutlined />}
            onClick={load}
            disabled={busy || running}
          >
            刷新状态
          </Button>
        </Stack>
        {error && (
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" onClose={() => setNotice("")}>
            {notice}
          </Alert>
        )}
        {overview && (
          <>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, overflowX: "auto" }}>
              <Stepper alternativeLabel sx={{ minWidth: overview.mode === "external" ? 680 : 540 }}>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Paper>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) minmax(340px, .42fr)" },
                gap: 2,
              }}
            >
              <Stack spacing={2}>
                <Paper variant="outlined" sx={{ p: 2.5 }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    sx={{ justifyContent: "space-between", mb: 2 }}
                  >
                    <Box>
                      <Typography variant="h6">发布前检查</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {overview.repositoryLabel} · {overview.branch ?? "游离 HEAD"}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Chip size="small" label={`领先 ${overview.ahead}`} />
                      <Chip size="small" label={`落后 ${overview.behind}`} />
                    </Stack>
                  </Stack>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                      gap: 1,
                    }}
                  >
                    {overview.checks.map((check) => (
                      <Alert
                        key={check.key}
                        severity={checkColors[check.status]}
                        variant="outlined"
                        icon={false}
                        sx={{ py: 0.5 }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 650 }}>
                          {check.label}
                        </Typography>
                        <Typography variant="caption">{check.detail}</Typography>
                      </Alert>
                    ))}
                  </Box>
                  <Button
                    sx={{ mt: 2 }}
                    startIcon={<FactCheckOutlined />}
                    variant="contained"
                    onClick={() => startOperation("validate")}
                    disabled={busy || running}
                  >
                    运行发布校验
                  </Button>
                </Paper>

                <Paper variant="outlined">
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ p: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}
                  >
                    <Box>
                      <Typography variant="h6">选择提交内容</Typography>
                      <Typography variant="body2" color="text.secondary">
                        只会暂存并提交勾选的受管理文件。
                      </Typography>
                    </Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={allSelected}
                          indeterminate={selected.length > 0 && !allSelected}
                          onChange={() =>
                            setSelected(allSelected ? [] : selectable.map((change) => change.path))
                          }
                        />
                      }
                      label="全选可发布项"
                    />
                  </Stack>
                  <Divider />
                  {overview.changes.length ? (
                    <List disablePadding>
                      {overview.changes.map((change) => {
                        const enabled = change.managed && !change.conflict && !change.staged;
                        return (
                          <ListItem
                            key={`${change.status}-${change.path}`}
                            disablePadding
                            secondaryAction={
                              change.managed && (
                                <Tooltip title="查看差异">
                                  <IconButton onClick={() => showDiff(change.path)}>
                                    <DifferenceOutlined />
                                  </IconButton>
                                </Tooltip>
                              )
                            }
                          >
                            <ListItemButton
                              disabled={!enabled}
                              onClick={() => enabled && toggle(change.path)}
                              sx={{ pr: 7 }}
                            >
                              <Checkbox
                                edge="start"
                                checked={selected.includes(change.path)}
                                disabled={!enabled}
                                tabIndex={-1}
                              />
                              <ListItemText
                                primary={
                                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                    <Typography
                                      component="span"
                                      sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}
                                    >
                                      {change.path}
                                    </Typography>
                                    <Chip
                                      size="small"
                                      label={statusLabel(change)}
                                      color={change.conflict ? "error" : "default"}
                                    />
                                    {!change.managed && (
                                      <Chip size="small" label="不属于管理范围" />
                                    )}
                                  </Stack>
                                }
                                secondary={
                                  change.originalPath ? `原路径：${change.originalPath}` : undefined
                                }
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  ) : (
                    <Box sx={{ p: 3 }}>
                      <Typography color="text.secondary">没有检测到工作树变更。</Typography>
                    </Box>
                  )}
                  <Divider />
                  <Stack spacing={1.5} sx={{ p: 2 }}>
                    <TextField
                      label="提交说明"
                      value={commitMessage}
                      onChange={(event) => setCommitMessage(event.target.value)}
                      helperText="使用 Conventional Commits，例如 feat(content): publish blog updates"
                      fullWidth
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        variant="contained"
                        startIcon={<SaveOutlined />}
                        onClick={commit}
                        disabled={busy || running || !overview.canCommit || !selected.length}
                      >
                        提交所选文件
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<CloudUploadOutlined />}
                        onClick={() => setDialog("push")}
                        disabled={busy || running || !overview.canPush}
                      >
                        推送当前分支
                      </Button>
                      <Button
                        color="warning"
                        variant="text"
                        startIcon={<RestoreOutlined />}
                        onClick={() => setDialog("revert")}
                        disabled={busy || running}
                      >
                        还原面板提交
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              </Stack>

              <Stack spacing={2}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      仓库信息
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      根目录
                    </Typography>
                    <Typography sx={{ fontFamily: "monospace", overflowWrap: "anywhere", mb: 1 }}>
                      {overview.repositoryRoot}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      上游分支
                    </Typography>
                    <Typography sx={{ fontFamily: "monospace" }}>
                      {overview.upstream ?? "未配置"}
                    </Typography>
                    {overview.head && (
                      <Typography variant="caption" color="text.secondary">
                        HEAD {overview.head.slice(0, 12)}
                      </Typography>
                    )}
                  </CardContent>
                </Card>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    同步与构建
                  </Typography>
                  <Stack spacing={1}>
                    {overview.mode === "external" && (
                      <Button
                        variant="outlined"
                        startIcon={<SyncOutlined />}
                        onClick={() => startOperation("sync")}
                        disabled={busy || running || !overview.canSync}
                      >
                        同步独立内容
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      startIcon={<BuildOutlined />}
                      onClick={() => startOperation("build")}
                      disabled={busy || running || !overview.canBuild}
                    >
                      构建 Mizuki
                    </Button>
                    {overview.mode === "external" && !overview.canBuild && (
                      <Typography variant="caption" color="text.secondary">
                        独立模式需要先提交全部受管理内容，再同步当前内容版本。
                      </Typography>
                    )}
                  </Stack>
                </Paper>

                <Paper
                  sx={{
                    p: 2,
                    bgcolor: "#111827",
                    color: "#e5e7eb",
                    minHeight: 280,
                    maxHeight: 520,
                    overflow: "auto",
                  }}
                >
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
                  >
                    <Typography sx={{ fontWeight: 650 }}>运行日志</Typography>
                    {operation && (
                      <Chip
                        size="small"
                        color={
                          operation.state === "failed"
                            ? "error"
                            : operation.state === "succeeded"
                              ? "success"
                              : operation.state === "running"
                                ? "warning"
                                : "default"
                        }
                        label={
                          operation.kind
                            ? `${operationLabels[operation.kind]} · ${operation.state}`
                            : "空闲"
                        }
                      />
                    )}
                  </Stack>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      fontSize: 12,
                      lineHeight: 1.65,
                    }}
                  >
                    {operation?.logs.join("\n") || "尚未运行校验、同步或构建。"}
                  </Box>
                </Paper>
              </Stack>
            </Box>
          </>
        )}

        <Dialog open={Boolean(diffPath)} onClose={() => setDiffPath("")} fullWidth maxWidth="lg">
          <DialogTitle>文件差异 · {diffPath}</DialogTitle>
          <DialogContent>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                bgcolor: "#111827",
                color: "#e5e7eb",
                borderRadius: 1,
                overflow: "auto",
                maxHeight: "65vh",
                whiteSpace: "pre-wrap",
                fontSize: 12,
              }}
            >
              {diff || "正在加载…"}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDiffPath("")}>关闭</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={dialog === "push"} onClose={() => setDialog(null)}>
          <DialogTitle>推送当前分支</DialogTitle>
          <DialogContent>
            <DialogContentText>
              将把当前分支已有提交推送到 {overview?.upstream}。未提交文件不会被包含。
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialog(null)}>取消</Button>
            <Button
              variant="contained"
              onClick={() =>
                mutate(() => api("/api/publish/push", json("POST")), "当前分支已推送。")
              }
              disabled={busy}
            >
              推送
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={dialog === "revert"} onClose={() => setDialog(null)}>
          <DialogTitle>还原最近的面板提交</DialogTitle>
          <DialogContent>
            <DialogContentText>
              面板会创建一个新的 Git revert 提交。只有本次面板会话创建且仍位于 HEAD
              的提交可以自动还原。
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialog(null)}>取消</Button>
            <Button
              color="warning"
              variant="contained"
              onClick={() =>
                mutate(() => api("/api/publish/revert", json("POST")), "已创建还原提交。")
              }
              disabled={busy}
            >
              创建还原提交
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Container>
  );
}
