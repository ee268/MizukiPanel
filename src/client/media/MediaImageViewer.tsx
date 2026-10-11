import { useCallback, useEffect, useRef, useState } from "react";
import ArrowBackIosNewOutlined from "@mui/icons-material/ArrowBackIosNewOutlined";
import ArrowForwardIosOutlined from "@mui/icons-material/ArrowForwardIosOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import FitScreenOutlined from "@mui/icons-material/FitScreenOutlined";
import ZoomInOutlined from "@mui/icons-material/ZoomInOutlined";
import ZoomOutOutlined from "@mui/icons-material/ZoomOutOutlined";
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { ProjectImage } from "../../shared/project-media";
import { mediaImageName, mediaImageUrl } from "./image";

const minZoom = 0.25;
const maxZoom = 16;
const zoomStep = 1.25;
const initialView = { zoom: 1, x: 0, y: 0 };
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

export function MediaImageViewer({
  items,
  initialPath,
  onClose,
}: {
  items: ProjectImage[];
  initialPath: string;
  onClose: () => void;
}) {
  const [path, setPath] = useState(initialPath);
  const index = Math.max(
    0,
    items.findIndex((item) => item.path === path),
  );
  const item = items[index];
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState(initialView);
  const fit =
    natural && viewport.width && viewport.height
      ? Math.min((viewport.width - 32) / natural.width, (viewport.height - 32) / natural.height, 1)
      : 1;
  const width = (natural?.width ?? 0) * fit;
  const height = (natural?.height ?? 0) * fit;
  const ready = Boolean(natural && !failed);
  const limitX = Math.max(0, (width * view.zoom - viewport.width) / 2);
  const limitY = Math.max(0, (height * view.zoom - viewport.height) / 2);

  useEffect(() => {
    const element = stage;
    if (!element) return;
    const update = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [stage]);

  const changeZoom = useCallback(
    (value: number | ((zoom: number) => number)) => {
      if (!ready) return;
      setView((previous) => {
        const zoom = Math.min(
          maxZoom,
          Math.max(minZoom, typeof value === "function" ? value(previous.zoom) : value),
        );
        return {
          zoom,
          x: clamp(previous.x, Math.max(0, (width * zoom - viewport.width) / 2)),
          y: clamp(previous.y, Math.max(0, (height * zoom - viewport.height) / 2)),
        };
      });
    },
    [ready, width, height, viewport],
  );

  useEffect(() => {
    const element = stage;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.deltaY) changeZoom((zoom) => zoom * (event.deltaY < 0 ? zoomStep : 1 / zoomStep));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [stage, changeZoom]);

  const select = (next: number) => {
    if (!items[next] || next === index) return;
    setPath(items[next].path);
    setNatural(null);
    setFailed(false);
    setView(initialView);
    drag.current = null;
    setDragging(false);
  };
  if (!item) return null;
  const name = mediaImageName(item);

  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      aria-labelledby="media-image-viewer-title"
      slotProps={{ paper: { sx: { overflow: "hidden" } } }}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const actions: Record<string, () => void> = {
          ArrowLeft: () => select(index - 1),
          ArrowRight: () => select(index + 1),
          "+": () => changeZoom((zoom) => zoom * zoomStep),
          "=": () => changeZoom((zoom) => zoom * zoomStep),
          "-": () => changeZoom((zoom) => zoom / zoomStep),
          "0": () => setView(initialView),
        };
        if (actions[event.key]) {
          event.preventDefault();
          event.stopPropagation();
          actions[event.key]();
        }
      }}
    >
      <Stack
        spacing={1}
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography id="media-image-viewer-title" variant="h6" component="h2">
              图片查看器
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
              {name}
            </Typography>
          </Box>
          <Tooltip title="关闭（Esc）">
            <IconButton aria-label="关闭图片查看器" onClick={onClose}>
              <CloseOutlined />
            </IconButton>
          </Tooltip>
        </Stack>
        <Stack
          direction="row"
          sx={{ gap: { xs: 0.5, sm: 1 }, alignItems: "center", flexWrap: "wrap" }}
        >
          <Tooltip title="上一张（←）">
            <span>
              <IconButton
                aria-label="上一张"
                disabled={index === 0}
                onClick={() => select(index - 1)}
              >
                <ArrowBackIosNewOutlined />
              </IconButton>
            </span>
          </Tooltip>
          <Typography variant="body2" aria-live="polite" sx={{ minWidth: 56, textAlign: "center" }}>
            {index + 1} / {items.length}
          </Typography>
          <Tooltip title="下一张（→）">
            <span>
              <IconButton
                aria-label="下一张"
                disabled={index === items.length - 1}
                onClick={() => select(index + 1)}
              >
                <ArrowForwardIosOutlined />
              </IconButton>
            </span>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="缩小（−）">
            <span>
              <IconButton
                aria-label="缩小"
                disabled={!ready || view.zoom <= minZoom}
                onClick={() => changeZoom((zoom) => zoom / zoomStep)}
              >
                <ZoomOutOutlined />
              </IconButton>
            </span>
          </Tooltip>
          <Typography
            variant="body2"
            aria-label="缩放比例"
            sx={{ minWidth: 52, textAlign: "center" }}
          >
            {ready ? `${Math.round(fit * view.zoom * 100)}%` : "—"}
          </Typography>
          <Tooltip title="放大（+）">
            <span>
              <IconButton
                aria-label="放大"
                disabled={!ready || view.zoom >= maxZoom}
                onClick={() => changeZoom((zoom) => zoom * zoomStep)}
              >
                <ZoomInOutlined />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="适应窗口（0）">
            <span>
              <IconButton
                aria-label="适应窗口"
                disabled={!ready}
                onClick={() => setView(initialView)}
              >
                <FitScreenOutlined />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      <Box
        ref={setStage}
        role="region"
        aria-label="图片预览"
        tabIndex={0}
        onDoubleClick={() => {
          if (ready) setView(view.zoom > 1 ? initialView : { zoom: 2, x: 0, y: 0 });
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || !ready || view.zoom <= 1) return;
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            pointer: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            startX: clamp(view.x, limitX),
            startY: clamp(view.y, limitY),
          };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const origin = drag.current;
          if (!origin || origin.pointer !== event.pointerId) return;
          setView((previous) => ({
            ...previous,
            x: clamp(origin.startX + event.clientX - origin.x, limitX),
            y: clamp(origin.startY + event.clientY - origin.y, limitY),
          }));
        }}
        onLostPointerCapture={() => {
          drag.current = null;
          setDragging(false);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        sx={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          bgcolor: "action.hover",
          touchAction: "none",
          outlineOffset: -3,
          cursor: dragging ? "grabbing" : ready && view.zoom > 1 ? "grab" : "zoom-in",
        }}
      >
        {!ready && !failed && (
          <Stack
            role="status"
            spacing={1.5}
            sx={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}
          >
            <CircularProgress size={32} />
            <Typography color="text.secondary">正在加载图片…</Typography>
          </Stack>
        )}
        {failed ? (
          <Alert severity="info" sx={{ m: 3 }}>
            当前图片无法预览，可关闭后复制路径查看，或切换其他图片。
          </Alert>
        ) : (
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width,
              height,
              transform: "translate(-50%, -50%)",
            }}
          >
            <Box
              component="img"
              key={item.path}
              alt={name}
              src={mediaImageUrl(item)}
              draggable={false}
              onLoad={(event) =>
                setNatural({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              onError={() => setFailed(true)}
              sx={{
                width: "100%",
                height: "100%",
                display: "block",
                opacity: ready ? 1 : 0,
                userSelect: "none",
                transform: `translate(${clamp(view.x, limitX)}px, ${clamp(view.y, limitY)}px) scale(${view.zoom})`,
                transformOrigin: "center",
              }}
            />
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
