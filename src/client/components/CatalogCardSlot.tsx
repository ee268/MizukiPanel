import { useEffect, useRef, useState, type ReactNode } from "react";
import { keyframes } from "@emotion/react";
import { Box } from "@mui/material";

const enter = keyframes`from { opacity: 0; transform: translateY(16px) scale(.98); } to { opacity: 1; transform: none; }`;

export function CatalogCardSlot({
  cardKey,
  label,
  kind,
  onSelect,
  children,
}: {
  cardKey: string;
  label: string;
  kind: "config" | "feature";
  onSelect: () => void;
  children: ReactNode;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = slot.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Keep focused controls mounted, including feature switches.
        setVisible(entry.isIntersecting || element.contains(document.activeElement));
      },
      { rootMargin: "0px", threshold: 0.01 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <Box
      ref={slot}
      data-config-slot={kind === "config" ? cardKey : undefined}
      data-feature-slot={kind === "feature" ? cardKey : undefined}
      tabIndex={visible ? undefined : 0}
      aria-label={visible ? undefined : label}
      onBlurCapture={() => {
        requestAnimationFrame(() => {
          const element = slot.current;
          if (!element || element.contains(document.activeElement)) return;
          const bounds = element.getBoundingClientRect();
          if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) setVisible(false);
        });
      }}
      onFocus={() => {
        if (!visible) {
          slot.current?.scrollIntoView({ block: "center", behavior: "instant" });
          setVisible(true);
        }
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect();
        }
      }}
      sx={{
        height: 144,
        minWidth: 0,
        borderRadius: 3,
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 3 },
      }}
    >
      {visible && (
        <Box
          sx={{
            height: "100%",
            animation: `${enter} 330ms cubic-bezier(.2,.7,.2,1)`,
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
}
