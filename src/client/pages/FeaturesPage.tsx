import { useEffect, useState } from "react";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { resourceLabel } from "../features/common";
import { errorMessage } from "../shared/errors";
import { FeatureResource } from "../features/FeatureResource";
import type { FeatureDataDescriptor, FeatureModule, ProjectReport } from "../types";
import { useNoticeDuration } from "../settings/useNoticeDuration";

interface IndexResponse {
  report: ProjectReport;
  modules: FeatureModule[];
  dataResources: FeatureDataDescriptor[];
}
export default function FeaturesPage() {
  const noticeDuration = useNoticeDuration(4500);
  const navigate = useNavigate();
  const [index, setIndex] = useState<IndexResponse | null>(null);
  const [selected, setSelected] = useState("about");
  const [resourceTab, setResourceTab] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    api<IndexResponse>("/api/features")
      .then(setIndex)
      .catch((cause) => setError(errorMessage(cause, "特色页清单读取失败")));
  }, []);
  const module = index?.modules.find((item) => item.key === selected);
  useEffect(() => {
    setResourceTab(0);
  }, [selected]);
  const resources = module?.resources ?? [];
  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box data-page-motion="heading">
          <Typography variant="h4">特色页面</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            管理 Markdown 正文、结构化数据、季度追番和相册资源。
          </Typography>
        </Box>
        {error && (
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {!index ? (
          <Paper variant="outlined" sx={{ minHeight: 420, display: "grid", placeItems: "center" }}>
            <CircularProgress />
          </Paper>
        ) : (
          <Grid container spacing={3}>
            <Grid data-page-motion="navigation" size={{ xs: 12, md: 3, lg: 2.5 }}>
              <Paper variant="outlined" sx={{ position: { md: "sticky" }, top: { md: 88 } }}>
                <List disablePadding>
                  {index.modules.map((item) => (
                    <ListItemButton
                      key={item.key}
                      selected={selected === item.key}
                      onClick={() => setSelected(item.key)}
                    >
                      <ListItemText
                        primary={item.label}
                        secondary={
                          !item.enabled
                            ? "页面已关闭"
                            : !item.navigationConfigured && item.switchKey
                              ? "导航未配置"
                              : "可管理"
                        }
                      />
                      <Chip
                        size="small"
                        color={item.enabled ? "success" : "default"}
                        label={item.enabled ? "开" : "关"}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            </Grid>
            <Grid data-page-motion="content" size={{ xs: 12, md: 9, lg: 9.5 }}>
              <Stack spacing={2}>
                <Paper variant="outlined" sx={{ p: 2.5 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{ alignItems: { sm: "center" } }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h5">{module?.label}</Typography>
                      <Typography color="text.secondary">{module?.pagePath}</Typography>
                    </Box>
                    <Button
                      startIcon={<OpenInNewOutlined />}
                      onClick={() =>
                        navigate(`/preview?path=${encodeURIComponent(module?.pagePath ?? "/")}`)
                      }
                    >
                      真实预览
                    </Button>
                    {module?.switchKey && (
                      <Button onClick={() => navigate("/config")}>页面开关与导航</Button>
                    )}
                  </Stack>
                  {module && !module.enabled && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      该页面已在 `siteConfig.featurePages`
                      中关闭。可继续编辑内容，预览前需要打开页面开关。
                    </Alert>
                  )}
                  {module?.switchKey && module.enabled && !module.navigationConfigured && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      页面已打开，但导航配置中未检测到入口。
                    </Alert>
                  )}
                  {resources.length > 1 && (
                    <Tabs
                      value={resourceTab}
                      onChange={(_, value) => setResourceTab(value)}
                      sx={{ mt: 1 }}
                    >
                      {resources.map((key) => (
                        <Tab key={key} label={resourceLabel(key)} />
                      ))}
                    </Tabs>
                  )}
                </Paper>
                {module &&
                ((module.key === "diary" && module.sourceMode === "memos") ||
                  (module.key === "anime" &&
                    resources[resourceTab] === "anime" &&
                    module.sourceMode !== "local")) ? (
                  <Paper variant="outlined" sx={{ p: 3 }}>
                    <Alert severity="info">
                      {module.sourceStatus}
                      。当前模式的数据由外部服务更新，面板不修改本地列表；请在站点配置中调整数据源。
                    </Alert>
                    <Button sx={{ mt: 2 }} onClick={() => navigate("/config")}>
                      打开站点配置
                    </Button>
                  </Paper>
                ) : (
                  module && (
                    <FeatureResource
                      resource={resources[resourceTab]}
                      report={index.report}
                      notify={setNotice}
                      fail={setError}
                    />
                  )
                )}
              </Stack>
            </Grid>
          </Grid>
        )}
      </Stack>
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={noticeDuration}
        onClose={() => setNotice("")}
        message={notice}
      />
    </Container>
  );
}
