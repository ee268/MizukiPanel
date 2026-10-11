import { Box, CircularProgress } from "@mui/material";
import { useLocation } from "react-router-dom";
import { ContentLoading } from "./ContentLoading";
import { WorkspaceLoading } from "../workspace/WorkspaceLoading";

const names: Record<string, string> = {
  "/": "工作区",
  "/articles": "文章",
  "/config": "站点配置",
  "/features": "特色页面",
  "/media": "媒体库",
  "/preview": "预览",
  "/publish": "发布管理",
  "/about": "面板信息",
  "/settings": "设置",
  "/login": "登录页面",
};
export function RouteLoading({ fullPage = false }: { fullPage?: boolean }) {
  const { pathname } = useLocation();
  if (pathname === "/login") {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress aria-label="正在加载登录页面" />
      </Box>
    );
  }
  if (pathname === "/") {
    return (
      <Box sx={{ minHeight: fullPage ? "100vh" : "60vh" }}>
        <WorkspaceLoading />
      </Box>
    );
  }
  const name = names[pathname] ?? names[`/${pathname.split("/")[1]}`] ?? "页面";
  return (
    <Box
      sx={{
        p: { xs: 2, sm: 4 },
        minHeight: fullPage ? "100vh" : "60vh",
        display: "grid",
        alignItems: "center",
      }}
    >
      <ContentLoading
        heading={`正在展开${name}`}
        description="正在准备页面内容与操作区域"
        kind={
          pathname === "/settings" || pathname === "/config"
            ? "settings"
            : pathname === "/media"
              ? "media"
              : pathname.startsWith("/articles")
                ? "article"
                : "page"
        }
      />
    </Box>
  );
}
