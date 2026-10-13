import { useEffect, useRef, useState, type ReactNode } from "react";
import { Box, useMediaQuery, type SxProps, type Theme } from "@mui/material";
import { keyframes } from "@emotion/react";

const arrive = keyframes`from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; }`;
const drift = keyframes`0%, 100% { transform: translateY(0) rotate(-8deg); } 50% { transform: translateY(-10px) rotate(-4deg); }`;

export const aboutPageMotion = `${arrive} 480ms cubic-bezier(.2,.7,.2,1) both`;
export const aboutContentMotion = `${arrive} 360ms ease both`;
export const aboutDrift = `${drift} 8s ease-in-out infinite`;
export const interactiveSurface = {
  borderRadius: "22px",
  transition: "transform 240ms ease, border-color 240ms ease, box-shadow 240ms ease",
  "@media (hover: hover) and (pointer: fine)": {
    "&:hover": {
      transform: "translateY(-5px)",
      borderColor: "primary.main",
      boxShadow: "0 16px 36px color-mix(in srgb, var(--mui-palette-primary-main) 9%, transparent)",
      "& .about-feature-icon": { transform: "rotate(-8deg) scale(1.08)" },
    },
  },
} satisfies SxProps<Theme>;

export function AboutReveal({
  children,
  delay = 0,
  sx,
}: {
  children: ReactNode;
  delay?: number;
  sx?: SxProps<Theme>;
}) {
  const element = useRef<HTMLDivElement>(null);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (reduced || !element.current || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [reduced]);
  return (
    <Box
      ref={element}
      sx={[
        {
          minWidth: 0,
          opacity: visible || reduced ? 1 : 0,
          transform: visible || reduced ? "none" : "translateY(22px)",
          transition: `opacity 550ms ease ${delay}ms, transform 550ms cubic-bezier(.2,.7,.2,1) ${delay}ms`,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  );
}
