import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import {
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { contributionCalendar, contributionLevel } from "../dashboard-contributions";
import type { DashboardOverview } from "../types";

function contributionDateLabel(date: string, count: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日 · ${count} 次提交`;
}

function ContributionGraph({ git }: { git: DashboardOverview["git"] }) {
  const theme = useTheme();
  const calendar = contributionCalendar(git.activity);
  const opacities = [1, 0.25, 0.5, 0.75, 1];
  const cellSize = 12;
  const gap = 3;
  const graphWidth = calendar.weeks.length * (cellSize + gap) - gap;
  const dayLabels = ["", "一", "", "三", "", "五", ""];

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { sm: "flex-start" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="h6">Git 提交贡献</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Mizuki 项目仓库最近一年的提交活动
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Chip size="small" label={`共 ${git.totalCommits} 次`} />
          <Chip size="small" label={`当前连续 ${git.currentStreak} 天`} />
          <Chip size="small" label={`最长连续 ${git.longestStreak} 天`} />
        </Stack>
      </Stack>

      {git.available ? (
        <>
          <Box
            role="img"
            aria-label={`最近一年共 ${git.totalCommits} 次 Git 提交`}
            sx={{ mt: 3, overflowX: "auto", pb: 1 }}
          >
            <Box sx={{ minWidth: graphWidth + 34, width: "max-content" }}>
              <Box
                sx={{
                  display: "grid",
                  gap: `${gap}px`,
                  gridTemplateColumns: `repeat(${calendar.weeks.length}, ${cellSize}px)`,
                  height: 20,
                  ml: "34px",
                  width: graphWidth,
                }}
              >
                {calendar.months.map((month) => (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    key={`${month.label}-${month.column}`}
                    sx={{
                      fontSize: 11,
                      gridColumn: `${month.column + 1} / span 4`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {month.label}
                  </Typography>
                ))}
              </Box>
              <Stack direction="row" spacing="6px">
                <Box
                  aria-hidden
                  sx={{
                    display: "grid",
                    fontSize: 10,
                    gridTemplateRows: `repeat(7, ${cellSize}px)`,
                    height: 7 * cellSize + 6 * gap,
                    rowGap: `${gap}px`,
                    textAlign: "right",
                    width: 28,
                  }}
                >
                  {dayLabels.map((label, index) => (
                    <Box color="text.secondary" key={index} sx={{ lineHeight: `${cellSize}px` }}>
                      {label}
                    </Box>
                  ))}
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gap: `${gap}px`,
                    gridAutoFlow: "column",
                    gridTemplateColumns: `repeat(${calendar.weeks.length}, ${cellSize}px)`,
                    gridTemplateRows: `repeat(7, ${cellSize}px)`,
                    width: graphWidth,
                  }}
                >
                  {calendar.weeks.flatMap((week, weekIndex) =>
                    week.days.map((day, dayIndex) =>
                      day ? (
                        <Tooltip
                          arrow
                          key={day.date}
                          title={contributionDateLabel(day.date, day.count)}
                        >
                          <Box
                            component="span"
                            sx={{
                              bgcolor: day.count > 0 ? "primary.main" : "transparent",
                              border: `1px solid ${theme.palette.divider}`,
                              opacity: opacities[contributionLevel(day.count)],
                              borderRadius: "3px",
                              display: "block",
                              height: cellSize,
                              width: cellSize,
                            }}
                          />
                        </Tooltip>
                      ) : (
                        <Box
                          aria-hidden
                          key={`empty-${weekIndex}-${dayIndex}`}
                          sx={{ height: cellSize, visibility: "hidden", width: cellSize }}
                        />
                      ),
                    ),
                  )}
                </Box>
              </Stack>
            </Box>
          </Box>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ alignItems: "center", justifyContent: "flex-end", mt: 1 }}
          >
            <Typography variant="caption" color="text.secondary">
              少
            </Typography>
            {opacities.map((opacity, index) => (
              <Box
                aria-hidden
                key={index}
                sx={{
                  bgcolor: index > 0 ? "primary.main" : "transparent",
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: "3px",
                  height: cellSize,
                  opacity,
                  width: cellSize,
                }}
              />
            ))}
            <Typography variant="caption" color="text.secondary">
              多
            </Typography>
          </Stack>
        </>
      ) : (
        <Box
          sx={{
            alignItems: "center",
            color: "text.secondary",
            display: "flex",
            minHeight: 170,
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          无法读取 Mizuki 项目仓库的提交历史
        </Box>
      )}
    </Paper>
  );
}

function RecentArticles({ articles }: { articles: DashboardOverview["articles"] }) {
  return (
    <Paper variant="outlined" sx={{ height: "100%", overflow: "hidden" }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", justifyContent: "space-between", px: 3, py: 2.5 }}
      >
        <Box>
          <Typography variant="h6">最近文章</Typography>
          <Typography variant="body2" color="text.secondary">
            按 Frontmatter 的 published 排序
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          to="/articles"
          size="small"
          endIcon={<ArrowForwardOutlined />}
        >
          查看全部
        </Button>
      </Stack>
      <Divider />
      {articles.recent.length ? (
        <List disablePadding>
          {articles.recent.map((article, index) => (
            <Box key={article.id}>
              {index > 0 && <Divider />}
              <ListItemButton
                component={RouterLink}
                to={`/articles?post=${encodeURIComponent(article.id)}`}
                sx={{ px: 3, py: 1.5 }}
              >
                <ListItemText
                  primary={article.title}
                  secondary={`${article.published.slice(0, 10)} · ${article.format.toUpperCase()}`}
                  slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
                />
                {article.draft && <Chip size="small" label="草稿" sx={{ ml: 2 }} />}
              </ListItemButton>
            </Box>
          ))}
        </List>
      ) : (
        <Box sx={{ color: "text.secondary", p: 5, textAlign: "center" }}>暂无文章</Box>
      )}
    </Paper>
  );
}

function PopularTags({ articles }: { articles: DashboardOverview["articles"] }) {
  const tags = articles.tags.slice(0, 10);
  return (
    <Paper variant="outlined" sx={{ height: "100%", p: 3 }}>
      <Typography variant="h6">热门标签</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        按文章使用数量排序
      </Typography>
      {tags.length ? (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 3 }}>
          {tags.map((tag, index) => (
            <Chip
              key={tag.name}
              color={index < 3 ? "primary" : "default"}
              label={`${tag.name} · ${tag.count}`}
              variant={index < 3 ? "filled" : "outlined"}
            />
          ))}
        </Stack>
      ) : (
        <Box sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>文章尚未设置标签</Box>
      )}
    </Paper>
  );
}

export function DashboardActivityPanels({ dashboard }: { dashboard: DashboardOverview }) {
  return (
    <Stack spacing={2}>
      <ContributionGraph git={dashboard.git} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <RecentArticles articles={dashboard.articles} />
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <PopularTags articles={dashboard.articles} />
        </Grid>
      </Grid>
    </Stack>
  );
}
