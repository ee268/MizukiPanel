import { useEffect, useRef, useState } from "react";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import { Box } from "@mui/material";

interface LazyArticleCoverProps {
  src: string;
  title: string;
}

export function LazyArticleCover({ src, title }: LazyArticleCoverProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setVisible(false);
    setFailed(false);

    const element = container.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [src]);

  return (
    <Box
      ref={container}
      sx={{
        aspectRatio: "16 / 9",
        bgcolor: "action.hover",
        display: "grid",
        overflow: "hidden",
        placeItems: "center",
      }}
    >
      {visible && !failed ? (
        <Box
          component="img"
          src={src}
          alt={`${title}封面`}
          loading="lazy"
          onError={() => setFailed(true)}
          sx={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
        />
      ) : (
        <ImageOutlined color="disabled" />
      )}
    </Box>
  );
}
