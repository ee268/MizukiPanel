import { lazy, Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./auth/RequireAuth";
import { BackToTop } from "./components/BackToTop";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const WorkspacePage = lazy(() => import("./pages/WorkspacePage"));
const ArticlesPage = lazy(() => import("./pages/ArticlesPage"));
const MediaPage = lazy(() => import("./pages/MediaPage"));
const PreviewPage = lazy(() => import("./pages/PreviewPage"));
const ConfigPage = lazy(() => import("./pages/ConfigPage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const PublishPage = lazy(() => import("./pages/PublishPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));

function LoadingFallback() {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <CircularProgress />
    </Box>
  );
}

export default function App() {
  return (
    <>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<WorkspacePage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/config" element={<ConfigPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/media" element={<MediaPage />} />
            <Route path="/preview" element={<PreviewPage />} />
            <Route path="/publish" element={<PublishPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <BackToTop />
    </>
  );
}
