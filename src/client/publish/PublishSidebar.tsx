import BuildOutlined from "@mui/icons-material/BuildOutlined";
import SyncOutlined from "@mui/icons-material/SyncOutlined";
import { Box, Button, Card, CardContent, Chip, Paper, Stack, Typography } from "@mui/material";
import type { PublishOperationStatus, PublishOverview } from "../types";
import { operationLabels } from "./constants";
import type { PublishOperationKind } from "./usePublish";

interface PublishSidebarProps {
  overview: PublishOverview;
  operation: PublishOperationStatus | null;
  disabled: boolean;
  onOperation: (kind: PublishOperationKind) => void;
}

function operationColor(operation: PublishOperationStatus) {
  if (operation.state === "failed") {
    return "error";
  }
  if (operation.state === "succeeded") {
    return "success";
  }
  if (operation.state === "running") {
    return "warning";
  }
  return "default";
}

export function PublishSidebar({
  overview,
  operation,
  disabled,
  onOperation,
}: PublishSidebarProps) {
  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            仓库信息
          </Typography>
          <Typography variant="body2" color="text.secondary">
            根目录
          </Typography>
          <Typography
            sx={{ fontFamily: "var(--mizuki-panel-font-mono)", overflowWrap: "anywhere", mb: 1 }}
          >
            {overview.repositoryRoot}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            上游分支
          </Typography>
          <Typography sx={{ fontFamily: "var(--mizuki-panel-font-mono)" }}>
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
              onClick={() => onOperation("sync")}
              disabled={disabled || !overview.canSync}
            >
              同步独立内容
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<BuildOutlined />}
            onClick={() => onOperation("build")}
            disabled={disabled || !overview.canBuild}
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
              color={operationColor(operation)}
              label={
                operation.kind ? `${operationLabels[operation.kind]} · ${operation.state}` : "空闲"
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
  );
}
