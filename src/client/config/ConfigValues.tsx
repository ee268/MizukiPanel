import { Box, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import type { ConfigValue, SiteConfigDocument } from "../types";

function formatValue(value: ConfigValue | null) {
  return value === null ? "（未设置覆盖值）" : JSON.stringify(value, null, 2);
}

function ValueCard({ title, value }: { title: string; value: ConfigValue | null }) {
  return (
    <Grid size={{ xs: 12, xl: 4 }}>
      <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
        <Typography variant="h6">{title}</Typography>
        <Box
          component="pre"
          sx={{
            m: 0,
            mt: 1.5,
            p: 1.5,
            maxHeight: 520,
            overflow: "auto",
            borderRadius: 1,
            bgcolor: "action.hover",
            fontSize: 12,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {formatValue(value)}
        </Box>
      </Paper>
    </Grid>
  );
}

export function ConfigValues({ document }: { document: SiteConfigDocument }) {
  return (
    <Grid container spacing={2}>
      <ValueCard title="上游默认值" value={document.defaultValue} />
      {document.mode === "external" && (
        <ValueCard title="内容仓库覆盖值" value={document.overrideValue} />
      )}
      <ValueCard title="最终生效值" value={document.effectiveValue} />
      <Grid size={{ xs: 12 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6">差异路径</Typography>
          {document.changedPaths.length ? (
            <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: "wrap" }}>
              {document.changedPaths.map((path) => (
                <Chip key={path} label={path} size="small" />
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              当前配置与默认值一致。
            </Typography>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
}
