import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import { Alert, Box, Button, Container, Stack, Typography } from "@mui/material";
import { DashboardActivityPanels } from "../components/DashboardActivityPanels";
import { DashboardCharts } from "../components/DashboardCharts";
import { DashboardMetrics } from "../workspace/DashboardMetrics";
import { useWorkspace } from "../workspace/useWorkspace";
import { WorkspaceConnection } from "../workspace/WorkspaceConnection";

export default function WorkspacePage() {
  const workspace = useWorkspace();
  const { data, dashboard, dashboardError, error, busy, loading } = workspace;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box data-page-motion="heading">
          <Typography variant="h4">项目工作区</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            连接本机 Mizuki 项目，查看文章与提交活动概览。
          </Typography>
        </Box>

        <WorkspaceConnection
          projectPath={workspace.projectPath}
          connected={Boolean(data?.connectedPath)}
          busy={busy}
          onPathChange={workspace.setProjectPath}
          onConnect={workspace.connect}
          onSelect={workspace.selectAndConnect}
          onDisconnect={workspace.disconnect}
        />

        {(error || data?.connectionError) && (
          <Alert severity="error">
            {error || `已保存的项目无法读取：${data?.connectionError}`}
          </Alert>
        )}

        {data?.report && (
          <>
            {data.report.warnings.map((warning) => (
              <Alert key={warning} severity={data.report?.readOnly ? "warning" : "info"}>
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
                onClick={workspace.reload}
                disabled={loading}
              >
                刷新数据
              </Button>
            </Stack>

            {dashboardError && <Alert severity="error">{dashboardError}</Alert>}
            {!dashboardError && <DashboardMetrics dashboard={dashboard} loading={loading} />}
            {dashboard && <DashboardCharts articles={dashboard.articles} />}
            {dashboard && <DashboardActivityPanels dashboard={dashboard} />}
            {dashboard?.articles.total === 0 && (
              <Alert severity="info">当前内容目录中还没有 Markdown 或 MDX 文章。</Alert>
            )}
            {dashboard && dashboard.articles.invalid > 0 && (
              <Alert severity="warning">
                有 {dashboard.articles.invalid} 篇文章的 Frontmatter
                无法纳入统计，请在文章管理中修复。
              </Alert>
            )}
          </>
        )}

        {data && !data.report && !data.connectionError && (
          <Alert severity="info">连接项目后可查看内容数据总览，并管理文章、媒体和站点配置。</Alert>
        )}
        {data?.warnings.map((warning) => (
          <Alert key={warning} severity="warning">
            {warning}
          </Alert>
        ))}
        {Boolean(data?.recentProjects.length) && (
          <Stack spacing={1}>
            <Typography variant="h6">最近项目</Typography>
            {data?.recentProjects.map((project) => (
              <Stack key={project.id} direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Box sx={{ flex: 1, overflowWrap: "anywhere" }}>
                  <Typography>
                    {project.name}
                    {data.defaultProject?.id === project.id ? "（默认项目）" : ""}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {project.path}
                    {project.error ? ` · ${project.error}` : ""}
                  </Typography>
                </Box>
                <Button
                  disabled={busy || !project.available}
                  onClick={() => void workspace.connectPath(project.path)}
                >
                  连接项目
                </Button>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
      {workspace.taskDialog}
    </Container>
  );
}
