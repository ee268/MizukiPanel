import {
  Box,
  Chip,
  Container,
  Divider,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";

const capabilities = [
  "管理文章内容、Frontmatter 与媒体资源",
  "编辑站点配置和全部特色页面",
  "启动 Astro 真实预览并查看运行日志",
  "查看内容数据与 Git 活动，并完成发布操作",
];

export default function AboutPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Box data-page-motion="heading">
          <Typography variant="h4">关于 MizukiPanel</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            面向 Mizuki Astro 博客的一站式本地管理面板。
          </Typography>
        </Box>

        <Paper data-page-motion="summary" variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h6" gutterBottom>
                作用与目标
              </Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>
                MizukiPanel 将博客内容、站点设置、预览和发布流程集中到可视化界面中，
                让使用者无需频繁手工编辑文件，同时保留 Mizuki 原有目录结构与 Git 工作流。
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h6">主要功能</Typography>
              <List disablePadding sx={{ mt: 1 }}>
                {capabilities.map((item) => (
                  <ListItem key={item} disableGutters sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={item}
                      slotProps={{ primary: { color: "text.secondary" } }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Divider />

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
            >
              <Box>
                <Typography variant="overline" color="text.secondary">
                  开源协议
                </Typography>
                <Box>
                  <Chip label="MIT License（临时）" size="small" />
                </Box>
              </Box>
              <Box sx={{ textAlign: { sm: "right" } }}>
                <Typography variant="overline" color="text.secondary">
                  开源地址
                </Typography>
                <Box>
                  <Link
                    href="https://www.example.com"
                    target="_blank"
                    rel="noreferrer"
                    underline="hover"
                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
                  >
                    www.example.com
                    <OpenInNewOutlined sx={{ fontSize: 16 }} />
                  </Link>
                </Box>
              </Box>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
