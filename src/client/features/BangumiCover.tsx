import { useState } from "react";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import BrokenImageOutlined from "@mui/icons-material/BrokenImageOutlined";
import { Box, Stack, Typography } from "@mui/material";
import { ContentLoading } from "../components/ContentLoading";

export function BangumiCover({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState("");
  const [failed, setFailed] = useState("");
  const state = !src ? "empty" : failed === src ? "error" : loaded === src ? "ready" : "loading";
  return (
    <Box
      role="img"
      aria-label={`${title}封面`}
      aria-busy={state === "loading"}
      data-cover-state={state}
      sx={{
        position: "relative",
        width: { xs: 80, sm: 96 },
        height: { xs: 116, sm: 138 },
        overflow: "hidden",
        borderRadius: 1,
        bgcolor: "action.hover",
        color: "text.secondary",
        flexShrink: 0,
        alignSelf: { xs: "start", sm: "center" },
      }}
    >
      {src && state !== "error" && (
        <Box
          component="img"
          src={src}
          alt=""
          decoding="async"
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: state === "ready" ? 1 : 0,
            transition: "opacity 220ms ease",
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
        />
      )}
      {state === "loading" && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
          }}
        >
          <ContentLoading
            heading="正在加载封面"
            description={title}
            kind="media"
            size="thumbnail"
            framed={false}
          />
        </Box>
      )}
      {(state === "empty" || state === "error") && (
        <Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center", gap: 0.75 }}>
          {state === "error" ? <BrokenImageOutlined /> : <ImageOutlined />}
          <Typography variant="caption">{state === "error" ? "封面不可用" : "暂无封面"}</Typography>
        </Stack>
      )}
    </Box>
  );
}
