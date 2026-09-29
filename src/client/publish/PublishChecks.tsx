import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import type { PublishOverview } from "../types";
import { checkColors } from "./constants";

interface PublishChecksProps {
  overview: PublishOverview;
  disabled: boolean;
  onValidate: () => void;
}

export function PublishChecks({ overview, disabled, onValidate }: PublishChecksProps) {
  return (
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
        onClick={onValidate}
        disabled={disabled}
      >
        运行发布校验
      </Button>
    </Paper>
  );
}
