import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import CommitOutlined from "@mui/icons-material/CommitOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import NoteAddOutlined from "@mui/icons-material/NoteAddOutlined";
import {
  Box,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import type { DashboardOverview } from "../types";

interface MetricCardProps {
  label: string;
  value: number | string;
  detail: string;
  icon: ReactNode;
}

function MetricCard({ label, value, detail, icon }: MetricCardProps) {
  const card = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const hoverPointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const enabled = hoverPointer && !reducedMotion;
  function reset() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const element = card.current;
    if (!element) return;
    element.style.removeProperty("--metric-rotate-x");
    element.style.removeProperty("--metric-rotate-y");
    element.style.removeProperty("--metric-lift");
    delete element.dataset.tilting;
  }
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.pointerType !== "mouse") return;
    // Measure the stationary wrapper so the tilted card cannot distort pointer coordinates.
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const element = card.current;
      if (!element) return;
      element.style.setProperty("--metric-rotate-x", `${-y * 6}deg`);
      element.style.setProperty("--metric-rotate-y", `${x * 6}deg`);
      element.style.setProperty("--metric-lift", "-3px");
      element.dataset.tilting = "true";
    });
  }
  useEffect(() => {
    if (!enabled) reset();
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("blur", reset);
      reset();
    };
  }, [enabled]);
  return (
    <Box
      data-page-motion="metric"
      onPointerEnter={tilt}
      onPointerMove={tilt}
      onPointerLeave={reset}
      onPointerCancel={reset}
      sx={{ height: "100%", perspective: "900px" }}
    >
      <Card
        ref={card}
        variant="outlined"
        sx={{
          height: "100%",
          transform:
            "translateY(var(--metric-lift, 0px)) rotateX(var(--metric-rotate-x, 0deg)) rotateY(var(--metric-rotate-y, 0deg))",
          transition: "transform 180ms ease-out, box-shadow 180ms ease-out",
          "&[data-tilting='true']": {
            boxShadow: (theme) =>
              theme.palette.mode === "dark"
                ? "0 12px 28px rgba(0, 0, 0, .3)"
                : "0 12px 28px rgba(30, 40, 60, .12)",
          },
          "@media (prefers-reduced-motion: reduce), (hover: none), (pointer: coarse)": {
            transform: "none",
            transition: "none",
          },
        }}
      >
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between" }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography component="p" variant="h4" sx={{ mt: 1, fontWeight: 700 }}>
                {value}
              </Typography>
            </Box>
            <Box
              sx={{
                alignItems: "center",
                bgcolor: "primary.main",
                borderRadius: 2,
                color: "primary.contrastText",
                display: "flex",
                height: 44,
                justifyContent: "center",
                width: 44,
              }}
            >
              {icon}
            </Box>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {detail}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

function MetricSkeleton() {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Skeleton width="45%" />
        <Skeleton variant="text" width="30%" sx={{ fontSize: "2.5rem", mt: 0.5 }} />
        <Skeleton width="70%" sx={{ mt: 1 }} />
      </CardContent>
    </Card>
  );
}

interface DashboardMetricsProps {
  dashboard: DashboardOverview | null;
  loading: boolean;
}

export function DashboardMetrics({ dashboard, loading }: DashboardMetricsProps) {
  const metrics: MetricCardProps[] = dashboard
    ? [
        {
          label: "文章总数",
          value: dashboard.articles.total,
          detail: `已发布 ${dashboard.articles.published} 篇`,
          icon: <ArticleOutlined />,
        },
        {
          label: "近 30 天新增",
          value: dashboard.articles.addedLast30Days,
          detail: "按 published 日期统计",
          icon: <NoteAddOutlined />,
        },
        {
          label: "草稿",
          value: dashboard.articles.drafts,
          detail: `计划发布 ${dashboard.articles.scheduled} 篇`,
          icon: <DescriptionOutlined />,
        },
        {
          label: "近 30 天提交",
          value: dashboard.git.available ? dashboard.git.commitsLast30Days : "—",
          detail: dashboard.git.available
            ? `最近一年共 ${dashboard.git.totalCommits} 次提交`
            : "Git 数据暂不可用",
          icon: <CommitOutlined />,
        },
      ]
    : [];

  return (
    <Grid container spacing={2}>
      {loading || !dashboard
        ? Array.from({ length: 4 }, (_, index) => (
            <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={index}>
              <MetricSkeleton />
            </Grid>
          ))
        : metrics.map((metric) => (
            <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={metric.label}>
              <MetricCard {...metric} />
            </Grid>
          ))}
    </Grid>
  );
}
