import { useEffect, useRef, useState, type PointerEvent } from "react";
import { fitPanel, resizePanel, type PanelRect, type ResizeDirection } from "./panel-geometry";
function viewportBounds() {
  const header =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--mizuki-panel-header-height"),
    ) || 65;
  return {
    left: 8,
    top: Math.min(header + 8, window.innerHeight - 16),
    right: window.innerWidth - 8,
    bottom: window.innerHeight - 8,
  };
}
function initialRect() {
  if (window.innerWidth < 32 || window.innerHeight < 32)
    return { left: 560, top: 73, width: 440, height: 680 };
  const bounds = viewportBounds();
  return fitPanel(
    { left: bounds.right - 440 - 16, top: bounds.bottom - 680 - 80, width: 440, height: 680 },
    bounds,
  );
}
export function useFloatingPanel() {
  const element = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState(initialRect);
  const gesture = useRef<{
    x: number;
    y: number;
    rect: PanelRect;
    direction?: ResizeDirection;
  } | null>(null);
  useEffect(() => {
    const resize = () => {
      gesture.current = null;
      if (window.innerWidth < 32 || window.innerHeight < 32) return;
      setRect((current) => fitPanel(current, viewportBounds()));
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  function start(event: PointerEvent<HTMLDivElement>, direction?: ResizeDirection) {
    if (
      event.button !== 0 ||
      (!direction && (event.target as Element).closest("button, input, [role=combobox]"))
    )
      return;
    event.preventDefault();
    gesture.current = { x: event.clientX, y: event.clientY, rect, direction };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  return {
    element,
    rect,
    start,
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const origin = gesture.current;
      if (!origin) return;
      const dx = event.clientX - origin.x,
        dy = event.clientY - origin.y;
      setRect(
        origin.direction
          ? resizePanel(origin.rect, origin.direction, dx, dy, viewportBounds())
          : fitPanel(
              { ...origin.rect, left: origin.rect.left + dx, top: origin.rect.top + dy },
              viewportBounds(),
            ),
      );
    },
    onPointerUp: () => {
      gesture.current = null;
    },
  };
}
