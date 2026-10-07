import { keyframes } from "@emotion/react";
import { Box, Paper, Stack, Typography } from "@mui/material";

const scanPage = keyframes`
  0%, 10% { transform: translateY(0); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  95%, 100% { transform: translateY(100px); opacity: 0; }
`;

const inkPulse = keyframes`
  0%, 100% { opacity: .38; }
  50% { opacity: 1; }
`;

interface ArticleLoadingProps {
  title?: string;
  phase?: "reading" | "preparing";
}

export function ArticleLoading({ title, phase = "reading" }: ArticleLoadingProps) {
  const preparing = phase === "preparing";

  return (
    <Paper
      variant="outlined"
      role="status"
      aria-live="polite"
      sx={{
        minHeight: 330,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        p: 4,
        backgroundImage:
          "radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--mui-palette-primary-main) 8%, transparent), transparent 58%)",
      }}
    >
      <Stack spacing={2.5} sx={{ alignItems: "center", textAlign: "center", maxWidth: 560 }}>
        <Box
          aria-hidden="true"
          sx={{
            position: "relative",
            width: 158,
            height: 144,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              width: 112,
              height: 126,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
              bgcolor: "background.paper",
              transform: "translate(10px, -6px) rotate(7deg)",
            }}
          />
          <Box
            sx={{
              position: "relative",
              width: 112,
              height: 126,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
              bgcolor: "background.paper",
              boxShadow: 3,
              transform: "rotate(-4deg)",
              overflow: "hidden",
              px: 2,
              py: 1.5,
              textAlign: "left",
              fontFamily: "var(--mizuki-panel-font-mono)",
              fontSize: 13,
            }}
          >
            <Box sx={{ color: "primary.main", fontWeight: 700 }}>---</Box>
            <Box sx={{ color: "text.secondary" }}>title:</Box>
            <Box sx={{ color: "primary.main", fontWeight: 700, mt: 0.5 }}># 文章</Box>
            <Box sx={{ color: "text.secondary", mt: 1.5 }}>正文 · · ·</Box>
            <Box
              sx={{
                position: "absolute",
                left: 12,
                right: 12,
                top: 14,
                height: 2,
                borderRadius: 1,
                bgcolor: "primary.main",
                boxShadow: "0 0 12px var(--mui-palette-primary-main)",
                animation: `${scanPage} 2.6s ease-in-out infinite`,
                "@media (prefers-reduced-motion: reduce)": { animation: "none" },
              }}
            />
          </Box>
        </Box>
        <Stack spacing={0.5} sx={{ alignItems: "center" }}>
          <Typography variant="h6">{preparing ? "正在整理正文" : "正在展开文章"}</Typography>
          <Typography color="text.secondary" sx={{ overflowWrap: "anywhere", textWrap: "balance" }}>
            {title ? `《${title}》` : "文章"} · {preparing ? "正在准备编辑区域" : "正在读取内容"}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <Box
              key={index}
              sx={{
                width: 18,
                height: 3,
                borderRadius: 1,
                bgcolor: "primary.main",
                animation: `${inkPulse} 1.4s ease-in-out ${index * 0.2}s infinite`,
                "@media (prefers-reduced-motion: reduce)": { animation: "none" },
              }}
            />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
