import { useState } from "react";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import { Box, Skeleton, Typography } from "@mui/material";
import type { ProjectImage } from "../../shared/project-media";
import { mediaImageUrl } from "./image";

export function MediaImagePreview({
  item,
  height = 180,
  fit = "contain",
}: {
  item?: ProjectImage;
  height?: number;
  fit?: "contain" | "cover";
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height,
        flexShrink: 0,
        bgcolor: "action.hover",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      {!item ? (
        <FolderOutlined sx={{ fontSize: 48, color: "primary.main" }} />
      ) : failed ? (
        <Typography color="text.secondary" variant="body2">
          当前格式无法预览
        </Typography>
      ) : (
        <>
          {!loaded && (
            <Skeleton
              variant="rectangular"
              width="100%"
              height="100%"
              sx={{ position: "absolute", inset: 0 }}
            />
          )}
          <Box
            component="img"
            alt=""
            loading="lazy"
            src={mediaImageUrl(item)}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            sx={{ width: "100%", height: "100%", objectFit: fit, opacity: loaded ? 1 : 0 }}
          />
        </>
      )}
    </Box>
  );
}
