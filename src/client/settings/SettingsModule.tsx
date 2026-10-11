import { useEffect, useRef, useState, type ReactNode } from "react";
import { Box } from "@mui/material";

/** Mount on entry; retain visited forms so local input and open dialogs survive scrolling. */
export function SettingsModule({
  label,
  children,
  estimatedHeight = 420,
  onVisibilityChange,
}: {
  label: string;
  children: ReactNode;
  estimatedHeight?: number;
  onVisibilityChange?: (visible: boolean) => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const notify = useRef(onVisibilityChange);
  notify.current = onVisibilityChange;
  useEffect(() => {
    const element = slot.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setMounted(true);
      notify.current?.(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setMounted(true);
        notify.current?.(entry.isIntersecting);
      },
      { rootMargin: "0px", threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <Box
      ref={slot}
      data-settings-module={label}
      data-settings-mounted={mounted}
      tabIndex={mounted ? -1 : 0}
      aria-label={mounted ? undefined : `载入${label}`}
      onFocus={() => {
        if (!mounted) {
          slot.current?.scrollIntoView({ block: "start", behavior: "instant" });
          setMounted(true);
        }
      }}
      sx={{
        minWidth: 0,
        minHeight: mounted ? undefined : estimatedHeight,
        scrollMarginTop: "calc(var(--mizuki-panel-header-height, 65px) + 16px)",
        contentVisibility: mounted ? "auto" : undefined,
        containIntrinsicSize: mounted ? `auto ${estimatedHeight}px` : undefined,
      }}
    >
      {mounted && children}
    </Box>
  );
}
