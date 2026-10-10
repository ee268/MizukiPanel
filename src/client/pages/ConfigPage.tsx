import { Alert, Box, Container, Grid, Snackbar, Stack, Typography } from "@mui/material";
import { useNoticeDuration } from "../settings/useNoticeDuration";
import { ConfigEditor } from "../config/ConfigEditor";
import { ConfigList } from "../config/ConfigList";
import { useConfigs } from "../config/useConfigs";

export default function ConfigPage() {
  const noticeDuration = useNoticeDuration(5000);
  const configs = useConfigs();

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box data-page-motion="heading">
          <Typography variant="h4">站点配置</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            管理 Mizuki 的 18 个站点配置，编辑前自动备份，每项最多保留 5 份。
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
          <Grid data-page-motion="navigation" size={{ xs: 12, md: 3, lg: 2.5 }}>
            <ConfigList
              groups={configs.groups}
              selected={configs.selected}
              onSelect={configs.select}
            />
          </Grid>
          <Grid data-page-motion="content" size={{ xs: 12, md: 9, lg: 9.5 }}>
            <ConfigEditor
              document={configs.document}
              initializer={configs.initializer}
              busy={configs.busy}
              backingUp={configs.backingUp}
              backups={configs.backups}
              onInitializerChange={configs.changeInitializer}
              onSave={configs.save}
              onDiscard={configs.discardChanges}
              onClear={() => configs.changeInitializer("{}")}
              onRestore={configs.restore}
            />
          </Grid>
        </Grid>
      </Stack>

      <Snackbar
        open={Boolean(configs.notice)}
        autoHideDuration={noticeDuration}
        onClose={() => configs.setNotice("")}
        message={configs.notice}
      />
    </Container>
  );
}
