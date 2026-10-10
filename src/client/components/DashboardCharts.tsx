import { useMemo, useState } from "react";
import {
  Box,
  Grid,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import { BarChart, PieChart } from "@mui/x-charts";
import {
  articleChartData,
  articleRangeTotal,
  type ArticleActivityRange,
} from "../dashboard-chart-data";
import type { DashboardOverview } from "../types";

const rangeLabels: Record<ArticleActivityRange, string> = {
  "30d": "30 天",
  "90d": "90 天",
  "12m": "12 个月",
};

export function DashboardCharts({ articles }: { articles: DashboardOverview["articles"] }) {
  const theme = useTheme();
  const [range, setRange] = useState<ArticleActivityRange>("30d");
  const activity = useMemo(
    () => articleChartData(articles.activity, range),
    [articles.activity, range],
  );
  const activityTotal = articleRangeTotal(activity);
  const tickInterval = range === "30d" ? 5 : range === "90d" ? 15 : 1;
  const statuses = [
    {
      id: "published",
      label: "已发布",
      value: articles.published,
      color: theme.palette.primary.main,
    },
    { id: "drafts", label: "草稿", value: articles.drafts, color: theme.palette.secondary.main },
    {
      id: "scheduled",
      label: "计划发布",
      value: articles.scheduled,
      color: theme.palette.warning.main,
    },
    { id: "invalid", label: "无效数据", value: articles.invalid, color: theme.palette.error.main },
  ];

  return (
    <Grid data-page-motion="chart" container spacing={2}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Paper variant="outlined" sx={{ height: "100%", minWidth: 0, p: { xs: 2, sm: 3 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">近期文章新增</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {rangeLabels[range]}内发布 {activityTotal} 篇文章
              </Typography>
            </Box>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={range}
              onChange={(_, next: ArticleActivityRange | null) => {
                if (next) setRange(next);
              }}
              aria-label="文章趋势时间范围"
            >
              <ToggleButton value="30d">30 天</ToggleButton>
              <ToggleButton value="90d">90 天</ToggleButton>
              <ToggleButton value="12m">12 个月</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Box sx={{ height: 300, minWidth: 0, mt: 2, width: "100%" }}>
            <BarChart
              dataset={activity}
              xAxis={[
                {
                  dataKey: "label",
                  scaleType: "band",
                  tickLabelInterval: (_, index) =>
                    index % tickInterval === 0 || index === activity.length - 1,
                },
              ]}
              yAxis={[{ min: 0, tickMinStep: 1, width: 36 }]}
              series={[
                {
                  dataKey: "count",
                  label: "新增文章",
                  color: theme.palette.primary.main,
                  valueFormatter: (value) => `${value ?? 0} 篇`,
                },
              ]}
              borderRadius={5}
              grid={{ horizontal: true }}
              height={300}
              hideLegend
              margin={{ top: 10, right: 10, bottom: 20, left: 0 }}
            />
          </Box>
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <Paper variant="outlined" sx={{ height: "100%", p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6">文章状态分布</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            共统计 {articles.total} 篇文章
          </Typography>
          {articles.total > 0 ? (
            <>
              <Box sx={{ height: 220, mt: 1 }}>
                <PieChart
                  series={[
                    {
                      data: statuses,
                      innerRadius: 52,
                      outerRadius: 86,
                      paddingAngle: 3,
                      cornerRadius: 4,
                      valueFormatter: (item) => `${item.value} 篇`,
                    },
                  ]}
                  height={220}
                  hideLegend
                />
              </Box>
              <Grid container spacing={1.5}>
                {statuses.map((status) => (
                  <Grid size={{ xs: 6 }} key={status.id}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Box
                        aria-hidden
                        sx={{ bgcolor: status.color, borderRadius: "50%", height: 10, width: 10 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {status.label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {status.value}
                      </Typography>
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </>
          ) : (
            <Box
              sx={{
                alignItems: "center",
                color: "text.secondary",
                display: "flex",
                height: 260,
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              发布文章后将在这里显示状态分布
            </Box>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
}
