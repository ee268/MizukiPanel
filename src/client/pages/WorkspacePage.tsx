import { FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import CommitOutlined from "@mui/icons-material/CommitOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import FolderOpenOutlined from "@mui/icons-material/FolderOpenOutlined";
import LinkOffOutlined from "@mui/icons-material/LinkOffOutlined";
import NoteAddOutlined from "@mui/icons-material/NoteAddOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import { api, json } from "../api";
import { DashboardCharts } from "../components/DashboardCharts";
import type { DashboardOverview, ProjectReport } from "../types";

interface WorkspaceData {
  connectedPath: string | null;
  report: ProjectReport | null;
  connectionError: string | null;
}

interface MetricCardProps {
  label: string;
  value: number | string;
  detail: string;
  icon: ReactNode;
}

function MetricCard({ label, value, detail, icon }: MetricCardProps) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between" }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography component="p" variant="h4" sx={{ mt: 1, fontWeight: 700 }}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "primary.main",
              borderRadius: 2,
              color: "primary.contrastText",
              display: "flex",
              height: 44,
              justifyContent: "center",
              width: 44,
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {detail}
        </Typography>
      </CardContent>
    </Card>
  );
}

function MetricSkeleton() {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Skeleton width="45%" />
        <Skeleton variant="text" width="30%" sx={{ fontSize: "2.5rem", mt: 0.5 }} />
        <Skeleton width="70%" sx={{ mt: 1 }} />
      </CardContent>
    </Card>
  );
}

export default function WorkspacePage() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardOverview | null>(null);
  const [projectPath, setProjectPath] = useState("");
  const [error, setError] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setDashboardError("");
    try {
      const next = await api<WorkspaceData>("/api/workspace");
      setData(next);
      setProjectPath(next.connectedPath ?? "");
      setDashboard(null);
      if (next.report) {
        try {
          setDashboard(await api<DashboardOverview>("/api/dashboard"));
        } catch (cause) {
          setDashboardError(cause instanceof Error ? cause.message : "数据总览读取失败");
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "工作区读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connectProject(nextPath: string) {
    await api(
      "/api/workspace/connect",
      json("POST", { projectPath: nextPath }),
    );
    setProjectPath(nextPath);
    await load();
    window.dispatchEvent(new Event("mizuki-site-identity-changed"));
  }

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await connectProject(projectPath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "连接失败");
    } finally {
      setBusy(false);
    }
  }

  async function selectAndConnect() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ path: string | null }>(
        "/api/workspace/select-directory",
        json("POST", { initialPath: projectPath }),
      );
      if (result.path) await connectProject(result.path);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法选择文件夹");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      await api("/api/workspace/disconnect", json("POST"));
      await load();
      window.dispatchEvent(new Event("mizuki-site-identity-changed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "断开失败");
    } finally {
      setBusy(false);
    }
  }

  const metrics = dashboard
    ? [
        {
          label: "文章总数",
          value: dashboard.articles.total,
          detail: `已发布 ${dashboard.articles.published} 篇`,
          icon: <ArticleOutlined />,
        },
        {
          label: "近 30 天新增",
          value: dashboard.articles.addedLast30Days,
          detail: "按 published 日期统计",
          icon: <NoteAddOutlined />,
        },
        {
          label: "草稿",
          value: dashboard.articles.drafts,
          detail: `计划发布 ${dashboard.articles.scheduled} 篇`,
          icon: <DescriptionOutlined />,
        },
        {
          label: "近 30 天提交",
          value: dashboard.git.available ? dashboard.git.commitsLast30Days : "—",
          detail: dashboard.git.available
            ? `最近一年共 ${dashboard.git.totalCommits} 次提交`
            : "Git 数据暂不可用",
          icon: <CommitOutlined />,
        },
      ]
    : [];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">项目工作区</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            连接本机 Mizuki 项目，查看文章与提交活动概览。
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack
            component="form"
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            onSubmit={connect}
            sx={{ alignItems: "center" }}
          >
            <TextField
              label="Mizuki 项目绝对路径"
              value={projectPath}
              onChange={(event) => setProjectPath(event.target.value)}
              placeholder="C:\\sites\\Mizuki"
              required
              fullWidth
            />
            <Button
              variant="contained"
              type="button"
              startIcon={<FolderOpenOutlined />}
              onClick={selectAndConnect}
              title="打开文件资源管理器选择 Mizuki 文件夹"
              disabled={busy}
              sx={{ minWidth: 150, height: 40 }}
            >
              {data?.report ? "重新连接" : "连接项目"}
            </Button>
            {data?.connectedPath && (
              <Button
                color="error"
                variant="outlined"
                onClick={disconnect}
                startIcon={<LinkOffOutlined />}
                disabled={busy}
                sx={{ minWidth: 120, height: 40 }}
              >
                断开
              </Button>
            )}
          </Stack>
        </Paper>

        {(error || data?.connectionError) && (
          <Alert severity="error">
            {error || `已保存的项目无法读取：${data?.connectionError}`}
          </Alert>
        )}

        {data?.report && (
          <>
            {data.report.warnings.map((warning) => (
              <Alert
                key={warning}
                severity={data.report?.readOnly ? "warning" : "info"}
              >
                {warning}
              </Alert>
            ))}

            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Box>
                <Typography variant="h5">数据总览</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  汇总当前内容和 Mizuki 项目仓库最近一年的活动。
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<RefreshOutlined />}
                onClick={load}
                disabled={loading}
              >
                刷新数据
              </Button>
            </Stack>

            {dashboardError && <Alert severity="error">{dashboardError}</Alert>}

            {!dashboardError && (
              <Grid container spacing={2}>
                {loading || !dashboard
                  ? Array.from({ length: 4 }, (_, index) => (
                      <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={index}>
                        <MetricSkeleton />
                      </Grid>
                    ))
                  : metrics.map((metric) => (
                      <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={metric.label}>
                        <MetricCard {...metric} />
                      </Grid>
                    ))}
              </Grid>
            )}

            {dashboard && <DashboardCharts articles={dashboard.articles} />}

            {dashboard && dashboard.articles.total === 0 && (
              <Alert severity="info">当前内容目录中还没有 Markdown 或 MDX 文章。</Alert>
            )}
            {dashboard && dashboard.articles.invalid > 0 && (
              <Alert severity="warning">
                有 {dashboard.articles.invalid} 篇文章的 Frontmatter 无法纳入统计，请在文章管理中修复。
              </Alert>
            )}
            {dashboard && !dashboard.git.available && (
              <Alert severity="info">
                Mizuki 项目仓库的提交历史暂不可用，文章统计不受影响。
              </Alert>
            )}
          </>
        )}

        {data && !data.report && !data.connectionError && (
          <Alert severity="info">
            连接项目后可查看内容数据总览，并管理文章、媒体和站点配置。
          </Alert>
        )}
      </Stack>
    </Container>
  );
}
