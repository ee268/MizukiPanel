import { Alert, Box, Container, Grid, Snackbar, Stack, Typography } from "@mui/material";
import { ConfigEditor } from "../config/ConfigEditor";
import { ConfigList } from "../config/ConfigList";
import { useConfigs } from "../config/useConfigs";

export default function ConfigPage() {
  const configs = useConfigs();

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">站点配置</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            管理 Mizuki 的 18 个可覆盖配置，查看默认值、覆盖值和最终值。
          </Typography>
        </Box>

        {configs.error && (
          <Alert severity="error" onClose={() => configs.setError("")}>
            {configs.error}
          </Alert>
        )}
        {configs.report?.readOnly && (
          <Alert severity="warning">当前工作区只读，配置只能查看。</Alert>
        )}

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 3, lg: 2.5 }}>
            <ConfigList
              groups={configs.groups}
              selected={configs.selected}
              onSelect={configs.select}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 9, lg: 9.5 }}>
            <ConfigEditor
              document={configs.document}
              initializer={configs.initializer}
              tab={configs.tab}
              busy={configs.busy}
              backupPath={configs.backupPath}
              onInitializerChange={configs.setInitializer}
              onTabChange={configs.setTab}
              onSave={configs.save}
              onDiscard={configs.discardChanges}
              onClear={() => configs.setInitializer("{}")}
              onRestore={configs.restore}
            />
          </Grid>
        </Grid>
      </Stack>

      <Snackbar
        open={Boolean(configs.notice)}
        autoHideDuration={5000}
        onClose={() => configs.setNotice("")}
        message={configs.notice}
      />
    </Container>
  );
}
