import { keyframes } from "@emotion/react";
import { Box, Paper, Stack, Typography } from "@mui/material";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  p: 0,
  m: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

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

interface ContentLoadingProps {
  heading: string;
  description: string;
  kind?: "article" | "media" | "settings" | "page";
  size?: "page" | "compact" | "inline" | "thumbnail";
  framed?: boolean;
}

export function ContentLoading({
  heading,
  description,
  kind = "article",
  size = "page",
  framed = true,
}: ContentLoadingProps) {
  const thumbnail = size === "thumbnail";
  const scale = size === "page" ? 1 : size === "compact" ? 0.6 : size === "inline" ? 0.35 : 0.24;
  const Icon =
    kind === "media" ? ImageOutlined : kind === "settings" ? TuneOutlined : DescriptionOutlined;
  return (
    <Paper
      variant="outlined"
      role="status"
      aria-live="polite"
      sx={{
        minHeight: size === "page" ? 330 : size === "compact" ? 190 : size === "inline" ? 96 : 0,
        height: thumbnail ? "100%" : undefined,
        width: "100%",
        border: framed ? undefined : "none",
        bgcolor: framed ? "background.paper" : "transparent",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        p: size === "page" ? 4 : thumbnail ? 0 : 1.5,
        backgroundImage:
          "radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--mui-palette-primary-main) 8%, transparent), transparent 58%)",
      }}
    >
      <Stack
        spacing={size === "page" ? 2.5 : 1}
        sx={{ alignItems: "center", textAlign: "center", maxWidth: 560, minWidth: 0 }}
      >
        <Box
          aria-hidden="true"
          sx={{ width: 158 * scale, height: 144 * scale, position: "relative", flexShrink: 0 }}
        >
          <Box
            aria-hidden="true"
            sx={{
              position: "relative",
              width: 158,
              height: 144,
              display: "grid",
              placeItems: "center",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
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
              {kind !== "article" ? (
                <>
                  <Icon sx={{ fontSize: 46, color: "primary.main", mt: 0.5 }} />
                  <Box sx={{ color: "text.secondary", mt: 1 }}>
                    {kind === "media" ? "图片" : kind === "settings" ? "设置" : "内容"} · · ·
                  </Box>
                </>
              ) : (
                <>
                  <Box sx={{ color: "primary.main", fontWeight: 700 }}>---</Box>
                  <Box sx={{ color: "text.secondary" }}>title:</Box>
                  <Box sx={{ color: "primary.main", fontWeight: 700, mt: 0.5 }}># 文章</Box>
                  <Box sx={{ color: "text.secondary", mt: 1.5 }}>正文 · · ·</Box>
                </>
              )}
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
        </Box>
        <Stack spacing={0.5} sx={thumbnail ? visuallyHidden : { alignItems: "center" }}>
          <Typography variant={size === "page" ? "h6" : "body2"} sx={{ fontWeight: 600 }}>
            {heading}
          </Typography>
          <Typography
            variant={size === "page" ? "body1" : "caption"}
            color="text.secondary"
            sx={{ overflowWrap: "anywhere", textWrap: "balance" }}
          >
            {description}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <Box
              key={index}
              sx={{
                width: size === "page" ? 18 : 8,
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
