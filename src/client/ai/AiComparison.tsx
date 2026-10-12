import { useMemo } from "react";
import { Alert, Box, Stack, Typography, alpha } from "@mui/material";
import { aiDiff } from "./ai-diff";
import { diffPreview } from "./diff-preview";
export function AiComparison({ before, after }: { before: string; after: string }) {
  const rows = useMemo(() => aiDiff(before, after), [before, after]);
  const changed = rows.filter((row) => row.changed).length;
  const preview = useMemo(() => diffPreview(rows), [rows]);
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">
        前后对比 · {changed ? `${changed} 行变化` : "内容一致"}
      </Typography>
      {preview.truncated && (
        <Alert severity="info">
          变化过多，对比显示前 600 行变化及上下文，采用时使用完整建议。可在下方编辑完整正文。
        </Alert>
      )}
      <Box
        sx={{
          maxHeight: 360,
          overflow: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
        data-testid="ai-comparison"
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            position: "sticky",
            top: 0,
            bgcolor: "background.paper",
            zIndex: 1,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Typography sx={{ p: 1, fontWeight: 600 }}>修改前</Typography>
          <Typography sx={{ p: 1, fontWeight: 600, borderLeft: 1, borderColor: "divider" }}>
            修改后
          </Typography>
        </Box>
        {preview.rows.map((row, index) =>
          "gap" in row ? (
            <Typography
              key={index}
              variant="caption"
              component="div"
              sx={{ px: 2, py: 0.5, color: "text.secondary", bgcolor: "action.hover" }}
            >
              省略 {row.gap} 行未变化内容
            </Typography>
          ) : (
            <Box
              key={index}
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
                fontFamily: "var(--mizuki-panel-font-mono)",
                fontSize: 12,
                lineHeight: 1.8,
                contentVisibility: "auto",
                containIntrinsicSize: "auto 24px",
              }}
            >
              {(["before", "after"] as const).map((side) => (
                <Box
                  key={side}
                  sx={{
                    px: 1,
                    display: "flex",
                    gap: 1,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    minWidth: 0,
                    borderLeft: side === "after" ? 1 : 0,
                    borderColor: "divider",
                    bgcolor: (theme) =>
                      row.changed && row[side] !== undefined
                        ? alpha(
                            side === "before"
                              ? theme.palette.error.main
                              : theme.palette.success.main,
                            theme.palette.mode === "dark" ? 0.15 : 0.09,
                          )
                        : undefined,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      color: "text.secondary",
                      flexShrink: 0,
                      minWidth: 24,
                      userSelect: "none",
                    }}
                  >
                    {side === "before" ? row.beforeLine : row.afterLine}
                  </Box>
                  <Box component="span" sx={{ minWidth: 0 }}>
                    {row[side] ?? " "}
                  </Box>
                </Box>
              ))}
            </Box>
          ),
        )}
      </Box>
    </Stack>
  );
}
