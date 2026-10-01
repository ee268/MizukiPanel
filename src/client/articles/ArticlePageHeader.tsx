import AddOutlined from "@mui/icons-material/AddOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import { Box, Button, Typography } from "@mui/material";

interface ArticlePageHeaderProps {
  editing: boolean;
  mode: "local" | "external" | "blocked" | undefined;
  count: number;
  readOnly: boolean;
  onBack: () => void;
  onCreate: () => void;
}

const positionTransition =
  "left 360ms cubic-bezier(0.2, 0, 0, 1), transform 360ms cubic-bezier(0.2, 0, 0, 1)";

export function ArticlePageHeader({
  editing,
  mode,
  count,
  readOnly,
  onBack,
  onCreate,
}: ArticlePageHeaderProps) {
  return (
    <Box sx={{ position: "relative", minHeight: { xs: 80, sm: 72 } }}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: editing ? "100%" : 0,
          transform: editing ? "translate(-100%, -50%)" : "translateY(-50%)",
          textAlign: editing ? "right" : "left",
          whiteSpace: "nowrap",
          transition: positionTransition,
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        <Typography variant="h4">文章管理</Typography>
        {!editing && (
          <Typography color="text.secondary">
            {mode === "external" ? "独立内容仓库" : "本地内容"} · {count} 篇文章
          </Typography>
        )}
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
          top: "50%",
          left: editing ? 0 : "100%",
          transform: editing ? "translateY(-50%)" : "translate(-100%, -50%)",
          opacity: editing ? 1 : 0,
          pointerEvents: editing ? "auto" : "none",
          whiteSpace: "nowrap",
          transition: `${positionTransition}, opacity 220ms ease`,
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        返回文章列表
      </Button>

      <Button
        variant="contained"
        startIcon={<AddOutlined />}
        onClick={onCreate}
        disabled={readOnly}
        aria-hidden={editing}
        tabIndex={editing ? -1 : 0}
        sx={{
          position: "absolute",
          top: "50%",
          right: 0,
          transform: "translateY(-50%)",
          opacity: editing ? 0 : 1,
          pointerEvents: editing ? "none" : "auto",
          whiteSpace: "nowrap",
          transition: "opacity 180ms ease",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        新建文章
      </Button>
    </Box>
  );
}
