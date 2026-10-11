import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, json } from "../api";
import { errorMessage } from "../shared/errors";
import { FeatureCatalog } from "../features/FeatureCatalog";
import type { FeatureDataDescriptor, FeatureModule, ProjectReport } from "../types";
import { useNoticeDuration } from "../settings/useNoticeDuration";
import { useLiveProjectReport } from "../workspace/WorkspaceSessionProvider";

const FeatureDetails = lazy(() =>
  import("../features/FeatureDetails").then((module) => ({ default: module.FeatureDetails })),
);
interface IndexResponse {
  report: ProjectReport;
  modules: FeatureModule[];
  dataResources: FeatureDataDescriptor[];
  siteConfigVersion: string;
}
function Loading() {
  return (
    <Paper variant="outlined" sx={{ minHeight: 420, display: "grid", placeItems: "center" }}>
      <CircularProgress aria-label="加载特色页面" />
    </Paper>
  );
}
export default function FeaturesPage() {
  const noticeDuration = useNoticeDuration(4500);
  const { featureKey } = useParams<{ featureKey: string }>();
  const selected = featureKey ?? null;
  const navigate = useNavigate();
  const location = useLocation();
  const [index, setIndex] = useState<IndexResponse | null>(null);
  const report = useLiveProjectReport(index?.report ?? null);
  const [visited, setVisited] = useState<string[]>(() => (selected ? [selected] : []));
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<{ key: string; enabled: boolean } | null>(null);
  const toggling = useRef(false);
  const catalogScroll = useRef(0);
  const catalogVisible = useRef(!selected);
  catalogVisible.current = !selected;
  const restoringScroll = useRef(false);
  const previousSelected = useRef(selected);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (selected)
      setVisited((previous) => (previous.includes(selected) ? previous : [...previous, selected]));
  }, [selected]);
  useLayoutEffect(() => {
    const before = previousSelected.current;
    previousSelected.current = selected;
    if (before === selected) return;
    restoringScroll.current = true;
    const top = selected ? 0 : catalogScroll.current;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top, behavior: "instant" });
      restoringScroll.current = false;
    });
    return () => {
      cancelAnimationFrame(frame);
      restoringScroll.current = false;
    };
  }, [selected]);
  useEffect(() => {
    const rememberScroll = () => {
      if (catalogVisible.current && !restoringScroll.current)
        catalogScroll.current = window.scrollY;
    };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => window.removeEventListener("scroll", rememberScroll);
  }, []);
  useEffect(() => {
    let alive = true;
    api<IndexResponse>("/api/features")
      .then((data) => {
        if (alive) setIndex(data);
      })
      .catch((cause) => {
        if (alive) setError(errorMessage(cause, "特色页清单读取失败"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  async function reload() {
    setLoading(true);
    try {
      setIndex(await api<IndexResponse>("/api/features"));
      setError("");
    } catch (cause) {
      setError(errorMessage(cause, "特色页清单读取失败"));
    } finally {
      setLoading(false);
    }
  }
  function open(key: string) {
    catalogScroll.current = window.scrollY;
    navigate(`/features/${encodeURIComponent(key)}${location.search}`, {
      state: { fromFeatureCatalog: true },
    });
  }
  function back() {
    if (location.state?.fromFeatureCatalog) navigate(-1);
    else navigate(`/features${location.search}`, { replace: true });
  }
  async function toggle(module: FeatureModule, enabled: boolean) {
    if (
      !index ||
      !module.switchKey ||
      report?.readOnly ||
      report?.mode === "blocked" ||
      toggling.current
    )
      return;
    toggling.current = true;
    setPending({ key: module.key, enabled });
    setError("");
    try {
      const result = await api<{ key: string; enabled: boolean; siteConfigVersion: string }>(
        "/api/feature/enabled",
        json("PUT", { key: module.key, enabled, version: index.siteConfigVersion }),
      );
      setIndex((previous) =>
        previous
          ? {
              ...previous,
              siteConfigVersion: result.siteConfigVersion,
              modules: previous.modules.map((item) =>
                item.key === result.key ? { ...item, enabled: result.enabled } : item,
              ),
            }
          : previous,
      );
      setNotice(`${module.label}页面已${result.enabled ? "开启" : "关闭"}。`);
    } catch (cause) {
      setError(errorMessage(cause, "页面开关保存失败"));
      if (cause instanceof ApiError && cause.status === 409) {
        try {
          setIndex(await api<IndexResponse>("/api/features"));
        } catch {
          /* Preserve the previous state if refreshing fails. */
        }
      }
    } finally {
      toggling.current = false;
      setPending(null);
    }
  }
  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Stack spacing={3}>
        {selected ? (
          <Button startIcon={<ArrowBackOutlined />} onClick={back} sx={{ alignSelf: "flex-start" }}>
            返回特色页面
          </Button>
        ) : (
          <Box data-page-motion="heading">
            <Typography variant="h4" component="h1">
              特色页面
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              搜索并选择页面，直接开启或关闭，管理正文、数据和图片资源。
            </Typography>
          </Box>
        )}
        {error && (
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {report?.readOnly && (
          <Alert severity="warning">当前工作区只读，页面开关和内容只能查看。</Alert>
        )}
        {!index ? (
          loading ? (
            <Loading />
          ) : (
            <Button onClick={() => void reload()}>重新加载特色页面</Button>
          )
        ) : (
          <>
            {selected && !index.modules.some((module) => module.key === selected) && (
              <Alert severity="info">没有找到该特色页面，请返回目录选择其他页面。</Alert>
            )}
            {!selected && (
              <FeatureCatalog
                modules={index.modules}
                query={query}
                onQueryChange={setQuery}
                readOnly={Boolean(report?.readOnly || report?.mode === "blocked")}
                pending={pending}
                onSelect={open}
                onToggle={toggle}
              />
            )}
            {(selected && !visited.includes(selected) ? [...visited, selected] : visited).map(
              (key) => {
                const module = index.modules.find((item) => item.key === key);
                // Keep each opened editor mounted when returning to the catalog so drafts and undo survive.
                return (
                  module && (
                    <Box
                      key={key}
                      hidden={selected !== key}
                      sx={{ display: selected !== key ? "none" : "block" }}
                    >
                      <Suspense fallback={<Loading />}>
                        <FeatureDetails
                          module={module}
                          report={report ?? index.report}
                          notify={setNotice}
                          fail={setError}
                        />
                      </Suspense>
                    </Box>
                  )
                );
              },
            )}
          </>
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
