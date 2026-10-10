import AddOutlined from "@mui/icons-material/AddOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import { Box, Button, Stack, Typography } from "@mui/material";

interface ArticlePageHeaderProps {
  editing: boolean;
  mode: "local" | "external" | "blocked" | undefined;
  count: number;
  readOnly: boolean;
  onBack: () => void;
  onTutorial: () => void;
  onCreate: () => void;
}

const positionTransition = "transform 360ms cubic-bezier(0.2, 0, 0, 1)";
const toRight = "translate(calc(100cqw - 100%), -50%)";
const toLeft = "translate(0, -50%)";

export function ArticlePageHeader({
  editing,
  mode,
  count,
  readOnly,
  onBack,
  onTutorial,
  onCreate,
}: ArticlePageHeaderProps) {
  return (
    <Box
      data-page-motion="heading"
      sx={{ position: "relative", containerType: "inline-size", minHeight: { xs: 148, sm: 88 } }}
    >
      <Box
        sx={{
          position: "absolute",
          top: { xs: "28%", sm: "50%" },
          left: 0,
          transform: editing ? toRight : toLeft,
          whiteSpace: "nowrap",
          transition: positionTransition,
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        <Typography variant="h4">文章管理</Typography>
        <Typography
          color="text.secondary"
          aria-hidden={editing}
          sx={{
            position: "absolute",
            top: "100%",
            left: 0,
            opacity: editing ? 0 : 1,
            transition: "opacity 180ms ease",
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
        >
          {mode === "external" ? "独立内容仓库" : "本地内容"} · {count} 篇文章
        </Typography>
      </Box>

      <Button
        startIcon={<ArrowBackOutlined />}
        onClick={(event) => {
          event.currentTarget.blur();
          onBack();
        }}
        aria-hidden={!editing}
        tabIndex={editing ? 0 : -1}
        sx={{
          position: "absolute",
          top: { xs: "28%", sm: "50%" },
          left: 0,
          transform: editing ? toLeft : toRight,
          opacity: editing ? 1 : 0,
          pointerEvents: editing ? "auto" : "none",
          whiteSpace: "nowrap",
          transition: `${positionTransition}, opacity 220ms ease`,
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        返回文章列表
      </Button>

      <Stack
        direction="row"
        spacing={1}
        aria-hidden={editing}
        sx={{
          position: "absolute",
          top: { xs: "82%", sm: "50%" },
          right: 0,
          transform: "translateY(-50%)",
          opacity: editing ? 0 : 1,
          pointerEvents: editing ? "none" : "auto",
          whiteSpace: "nowrap",
          transition: "opacity 180ms ease",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        <Button startIcon={<MenuBookOutlined />} onClick={onTutorial} tabIndex={editing ? -1 : 0}>
          Markdown 教程
        </Button>
        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          onClick={onCreate}
          disabled={readOnly}
          tabIndex={editing ? -1 : 0}
        >
          新建文章
        </Button>
      </Stack>
    </Box>
  );
}
