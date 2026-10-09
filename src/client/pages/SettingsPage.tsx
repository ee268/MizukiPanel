import { useState } from "react";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import {
  Box,
  Container,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { settingsSections } from "../settings/sections";

export default function SettingsPage() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const [sectionId, setSectionId] = useState<string>(settingsSections[0].id);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" component="h1">
            设置
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            管理 MizukiPanel 的显示、编辑与工作区偏好。
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "220px minmax(0, 1fr)" },
            gap: 3,
            alignItems: "start",
          }}
        >
          <Paper variant="outlined" sx={{ minWidth: 0, p: 1 }}>
            <Tabs
              value={sectionId}
              onChange={(_, value: string) => setSectionId(value)}
              orientation={desktop ? "vertical" : "horizontal"}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              aria-label="设置分类"
              sx={{
                "& .MuiTab-root": {
                  minHeight: 52,
                  justifyContent: "flex-start",
                  px: 2,
                },
              }}
            >
              {settingsSections.map((item) => (
                <Tab
                  key={item.id}
                  value={item.id}
                  id={`settings-tab-${item.id}`}
                  aria-controls={`settings-panel-${item.id}`}
                  icon={item.icon}
                  iconPosition="start"
                  label={item.title}
                />
              ))}
            </Tabs>
          </Paper>

          {settingsSections.map((item) => (
            <Paper
              key={item.id}
              variant="outlined"
              role="tabpanel"
              id={`settings-panel-${item.id}`}
              aria-labelledby={`settings-tab-${item.id}`}
              hidden={sectionId !== item.id}
              tabIndex={0}
              sx={{ p: { xs: 2.5, sm: 3.5 }, minWidth: 0 }}
            >
              <Typography variant="h6" component="h2">
                {item.title}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {item.description}
              </Typography>
              <Stack spacing={1.5} sx={{ py: 7, alignItems: "center", textAlign: "center" }}>
                <SettingsOutlined sx={{ fontSize: 40, color: "text.disabled" }} />
                <Typography color="text.secondary">此分类暂未提供可调整的选项。</Typography>
              </Stack>
            </Paper>
          ))}
        </Box>
      </Stack>
    </Container>
  );
}
