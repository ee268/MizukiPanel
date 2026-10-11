import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { PublishChanges } from "../publish/PublishChanges";
import { PublishHistory } from "../publish/PublishHistory";
import { PublishRepository } from "../publish/PublishRepository";
import { PublishDialogs } from "../publish/PublishDialogs";
import { operationLabels } from "../publish/constants";
import { usePublish } from "../publish/usePublish";
import { ContentLoading } from "../components/ContentLoading";
import { TaskLogs } from "../components/TaskLogs";
import { useWorkspaceSession } from "../workspace/WorkspaceSessionProvider";

const stateLabels = { idle: "空闲", running: "运行中", succeeded: "已完成", failed: "失败" };
export default function PublishPage() {
  const publish = usePublish();
  const workspace = useWorkspaceSession();
  const { overview, operation } = publish;
  if (!overview && !publish.error)
    return (
      <Box sx={{ p: 3 }}>
        <ContentLoading
          heading="正在展开发布管理"
          description="正在读取 Mizuki 的 Git 仓库与运行日志"
        />
      </Box>
    );
  const disabled = publish.busy || publish.running || workspace.data?.report?.readOnly === true;
  return (
    <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, lg: 3 } }}>
      <Stack spacing={2.5}>
        <Stack
          data-page-motion="heading"
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Box>
            <Typography variant="h4">发布管理</Typography>
            <Typography color="text.secondary">
              查看 Mizuki 提交历史，提交项目修改并运行构建。
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshOutlined />}
            onClick={() => void publish.load()}
            disabled={publish.busy}
          >
            刷新仓库
          </Button>
        </Stack>
        {publish.error && (
          <Alert severity="error" onClose={() => publish.setError("")}>
            {publish.error}
          </Alert>
        )}
        {publish.notice && (
          <Alert severity="success" onClose={() => publish.setNotice("")}>
            {publish.notice}
          </Alert>
        )}
        {overview?.warnings?.map((warning) => (
          <Alert severity="warning" key={warning}>
            {warning}
          </Alert>
        ))}
        {overview && (
          <>
            {overview.repositoryError && (
              <Alert severity="warning">Git 仓库不可用：{overview.repositoryError}</Alert>
            )}
            {workspace.data?.report?.readOnly && (
              <Alert severity="info">当前项目只读，可以查看提交历史、远程仓库与差异。</Alert>
            )}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  lg: "minmax(0, 1fr) minmax(300px, .4fr)",
                },
                gap: 2,
              }}
            >
              <Paper
                data-page-motion="content"
                variant="outlined"
                sx={{ minWidth: 0, alignSelf: "start" }}
              >
                <Tabs
                  value={publish.tab}
                  onChange={(_, tab) => publish.setTab(tab)}
                  variant="scrollable"
                  aria-label="Git 管理视图"
                  sx={{ borderBottom: 1, borderColor: "divider" }}
                >
                  <Tab
                    value="history"
                    label="提交历史"
                    id="git-history-tab"
                    aria-controls="git-history-panel"
                  />
                  <Tab
                    value="changes"
                    label={`工作区修改 (${overview.changes.length})`}
                    id="git-changes-tab"
                    aria-controls="git-changes-panel"
                  />
                </Tabs>
                <Box
                  role="tabpanel"
                  id={`git-${publish.tab}-panel`}
                  aria-labelledby={`git-${publish.tab}-tab`}
                >
                  {!overview.repositoryAvailable ? (
                    <Typography color="text.secondary" sx={{ p: 3 }}>
                      连接包含 Git 仓库的 Mizuki 项目后可查看历史与提交修改。
                    </Typography>
                  ) : publish.tab === "history" ? (
                    <PublishHistory
                      history={publish.history}
                      loading={publish.historyLoading}
                      error={publish.historyError}
                      page={publish.historyPage}
                      onPage={publish.setHistoryPage}
                      onCommit={publish.showCommit}
                    />
                  ) : (
                    <>
                      {overview.commitDisabledReason && (
                        <Alert severity="info" sx={{ m: 2 }}>
                          {overview.commitDisabledReason}
                        </Alert>
                      )}
                      <PublishChanges
                        overview={overview}
                        selected={publish.selected}
                        allSelected={publish.allSelected}
                        commitMessage={publish.commitMessage}
                        commitType={publish.commitType}
                        commitScope={publish.commitScope}
                        commitDescription={publish.commitDescription}
                        disabled={disabled}
                        onToggle={publish.toggle}
                        onToggleAll={publish.toggleAll}
                        onCommitTypeChange={publish.setCommitType}
                        onCommitScopeChange={publish.setCommitScope}
                        onCommitDescriptionChange={publish.setCommitDescription}
                        onShowDiff={publish.showDiff}
                        onCommit={publish.commit}
                      />
                    </>
                  )}
                </Box>
              </Paper>
              <PublishRepository overview={overview} disabled={disabled} onBuild={publish.build} />
            </Box>
          </>
        )}
        <Box data-page-motion="logs" sx={{ minWidth: 0 }}>
          <TaskLogs
            compact
            logs={operation?.logs ?? []}
            limit={operation?.logLimit}
            badge={
              <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Chip
                  size="small"
                  sx={
                    !operation?.kind
                      ? { color: "#e5e7eb", bgcolor: "rgba(148, 163, 184, .16)" }
                      : undefined
                  }
                  color={
                    operation?.state === "failed"
                      ? "error"
                      : operation?.state === "succeeded"
                        ? "success"
                        : operation?.state === "running"
                          ? "warning"
                          : "default"
                  }
                  label={
                    operation?.kind
                      ? `${operationLabels[operation.kind]} · ${stateLabels[operation.state]}`
                      : "Git 与构建日志"
                  }
                />
                <Button
                  size="small"
                  onClick={() =>
                    void publish
                      .refreshLogs()
                      .catch(() => publish.setError("日志读取失败，请重试。"))
                  }
                >
                  刷新日志
                </Button>
              </Stack>
            }
          />
        </Box>
        <PublishDialogs
          title={publish.detailTitle}
          detail={publish.detail}
          loading={publish.detailLoading}
          error={publish.detailError}
          onClose={publish.closeDetail}
        />
      </Stack>
    </Container>
  );
}
