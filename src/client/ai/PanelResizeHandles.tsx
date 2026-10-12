import { Box } from "@mui/material";
import { resizeDirections } from "./panel-geometry";
import type { useFloatingPanel } from "./useFloatingPanel";
const labels = {
  n: "上边",
  ne: "右上角",
  e: "右边",
  se: "右下角",
  s: "下边",
  sw: "左下角",
  w: "左边",
  nw: "左上角",
};
export function PanelResizeHandles({
  floating,
}: {
  floating: ReturnType<typeof useFloatingPanel>;
}) {
  return resizeDirections.map((direction) => {
    const corner = direction.length === 2;
    return (
      <Box
        key={direction}
        aria-label={`调整面板${labels[direction]}尺寸`}
        data-resize={direction}
        onPointerDown={(event) => floating.start(event, direction)}
        onPointerMove={floating.onPointerMove}
        onPointerUp={floating.onPointerUp}
        onPointerCancel={floating.onPointerUp}
        onLostPointerCapture={floating.onPointerUp}
        sx={{
          position: "absolute",
          zIndex: 2,
          touchAction: "none",
          cursor: `${direction}-resize`,
          ...(corner
            ? { width: 12, height: 12 }
            : direction === "n" || direction === "s"
              ? { left: 12, right: 12, height: 6 }
              : { top: 12, bottom: 12, width: 6 }),
          ...(direction.includes("n") ? { top: 0 } : {}),
          ...(direction.includes("s") ? { bottom: 0 } : {}),
          ...(direction.includes("w") ? { left: 0 } : {}),
          ...(direction.includes("e") ? { right: 0 } : {}),
        }}
      />
    );
  });
}
