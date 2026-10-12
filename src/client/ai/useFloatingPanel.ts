import { useEffect, useRef, useState, type PointerEvent } from "react";
export function useFloatingPanel() {
  const element = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  function clamp(left: number, top: number) {
    const rect = element.current?.getBoundingClientRect();
    const header =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--mizuki-panel-header-height"),
      ) || 65;
    return {
      left: Math.max(8, Math.min(left, window.innerWidth - (rect?.width ?? 0) - 8)),
      top: Math.max(header + 8, Math.min(top, window.innerHeight - (rect?.height ?? 0) - 8)),
    };
  }
  useEffect(() => {
    const resize = () =>
      setPosition((current) => (current ? clamp(current.left, current.top) : null));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return {
    element,
    position,
    resetPosition: () => setPosition(null),
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || (event.target as Element).closest("button")) return;
      const rect = element.current?.getBoundingClientRect();
      if (!rect) return;
      drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const origin = drag.current;
      if (origin)
        setPosition(
          clamp(origin.left + event.clientX - origin.x, origin.top + event.clientY - origin.y),
        );
    },
    onPointerUp: () => {
      drag.current = null;
    },
  };
}
