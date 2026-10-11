import { useState } from "react";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { Alert, Box, Button, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { resourceLabel } from "./common";
import { FeatureResource } from "./FeatureResource";
import type { FeatureModule, ProjectReport } from "../types";
import type { FeatureEditorCallbacks } from "./common";

export function FeatureDetails({
  module,
  report,
  notify,
  fail,
}: FeatureEditorCallbacks & {
  module: FeatureModule;
  report: ProjectReport;
}) {
  const navigate = useNavigate();
  const [resourceTab, setResourceTab] = useState(0);
  const resource = module.resources[resourceTab];
  const remote =
    (module.key === "diary" && module.sourceMode === "memos") ||
    (module.key === "anime" && resource === "anime" && module.sourceMode !== "local");
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ alignItems: { sm: "center" } }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" component="h1">
              {module.label}
            </Typography>
            <Typography color="text.secondary">{module.pagePath}</Typography>
          </Box>
          <Button
            startIcon={<OpenInNewOutlined />}
            onClick={() => navigate(`/preview?path=${encodeURIComponent(module.pagePath)}`)}
          >
            Mizuki预览
          </Button>
          {module.switchKey && (
            <Button onClick={() => navigate("/config?key=siteConfig")}>站点配置</Button>
          )}
        </Stack>
        {!module.enabled && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            该页面已关闭，仍可继续编辑内容。可返回页面目录打开开关。
          </Alert>
        )}
        {module.switchKey && module.enabled && !module.navigationConfigured && (
          <Alert severity="info" sx={{ mt: 2 }}>
            页面已打开，但导航配置中未检测到入口。
          </Alert>
        )}
        {module.resources.length > 1 && (
          <Tabs value={resourceTab} onChange={(_, value) => setResourceTab(value)} sx={{ mt: 1 }}>
            {module.resources.map((key) => (
              <Tab key={key} label={resourceLabel(key)} />
            ))}
          </Tabs>
        )}
      </Paper>
      {remote ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Alert severity="info">
            {module.sourceStatus}
            。当前模式的数据由外部服务更新，面板不修改本地列表；请在站点配置中调整数据源。
          </Alert>
          <Button sx={{ mt: 2 }} onClick={() => navigate("/config?key=siteConfig")}>
            打开站点配置
          </Button>
        </Paper>
      ) : (
        <FeatureResource resource={resource} report={report} notify={notify} fail={fail} />
      )}
    </Stack>
  );
}
