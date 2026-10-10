import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import { publishSteps } from "../publish/constants";
import { PublishChanges } from "../publish/PublishChanges";
import { PublishChecks } from "../publish/PublishChecks";
import { PublishDialogs } from "../publish/PublishDialogs";
import { PublishSidebar } from "../publish/PublishSidebar";
import { usePublish } from "../publish/usePublish";
import { useWorkspaceSession } from "../workspace/WorkspaceSessionProvider";

export default function PublishPage() {
  const publish = usePublish();
  const workspace = useWorkspaceSession();
  const { overview } = publish;

  if (!overview && !publish.error) {
    return (
      <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  const disabled = publish.busy || publish.running || workspace.data?.report?.readOnly === true;
  const steps = publishSteps(overview?.mode === "external");

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
            <Typography variant="h4">发布工作流</Typography>
            <Typography color="text.secondary">
              检查并发布选中的内容变更，随后使用 Mizuki 完成真实构建。
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshOutlined />}
            onClick={publish.load}
            disabled={disabled}
          >
            刷新状态
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
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, overflowX: "auto" }}>
              <Stepper alternativeLabel sx={{ minWidth: overview.mode === "external" ? 680 : 540 }}>
                {steps.map((label) => (
                  <Step data-page-motion="step" key={label}>
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
              <Stack data-page-motion="content" spacing={2}>
                <PublishChecks
                  overview={overview}
                  disabled={disabled}
                  onValidate={() => publish.startOperation("validate")}
                />
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
                  onOpenDialog={publish.setDialog}
                />
              </Stack>
              <PublishSidebar
                overview={overview}
                operation={publish.operation}
                disabled={disabled}
                onOperation={publish.startOperation}
              />
            </Box>
          </>
        )}

        <PublishDialogs
          overview={overview}
          diffPath={publish.diffPath}
          diff={publish.diff}
          dialog={publish.dialog}
          busy={publish.busy}
          onCloseDiff={() => publish.setDiffPath("")}
          onCloseDialog={() => publish.setDialog(null)}
          onPush={publish.push}
          onRevert={publish.revert}
        />
      </Stack>
    </Container>
  );
}
