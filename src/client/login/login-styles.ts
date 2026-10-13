import { keyframes } from "@emotion/react";
import type { Theme } from "@mui/material";

const arrive = keyframes`from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; }`;
const gradientFlow = keyframes({
  "0%": { backgroundPosition: "0% 45%, 100% 20%, 0% 50%" },
  "35%": { backgroundPosition: "35% 20%, 65% 70%, 45% 50%" },
  "70%": { backgroundPosition: "80% 65%, 15% 35%, 100% 50%" },
  "100%": { backgroundPosition: "0% 45%, 100% 20%, 0% 50%" },
});
const firstGlowFlow = keyframes({
  "0%, 100%": { transform: "translate3d(-8%, -6%, 0) scale(1)" },
  "45%": { transform: "translate3d(16%, 10%, 0) scale(1.14)" },
  "75%": { transform: "translate3d(5%, 18%, 0) scale(0.94)" },
});
const secondGlowFlow = keyframes({
  "0%, 100%": { transform: "translate3d(10%, 8%, 0) scale(1.06)" },
  "40%": { transform: "translate3d(-14%, 15%, 0) scale(0.92)" },
  "72%": { transform: "translate3d(-4%, -12%, 0) scale(1.12)" },
});
export const loginArrival = `${arrive} 560ms cubic-bezier(.2,.7,.2,1) both`;
export const themeMix = (color: string, amount: number) =>
  `color-mix(in srgb, ${color} ${amount}%, transparent)`;

export function loginBackground(theme: Theme) {
  const main = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;
  const dark = theme.palette.mode === "dark";
  const base = theme.palette.background.default;
  return {
    height: "100vh",
    "@supports (height: 100dvh)": { height: "100dvh" },
    display: "flex",
    flexDirection: "column",
    position: "relative",
    isolation: "isolate",
    overflow: "clip",
    bgcolor: "background.default",
    backgroundImage: [
      `radial-gradient(circle at 16% 22%, ${themeMix(main, dark ? 24 : 20)} 0%, transparent 38%)`,
      `radial-gradient(circle at 84% 18%, ${themeMix(secondary, dark ? 20 : 16)} 0%, transparent 36%)`,
      `linear-gradient(125deg, ${base} 5%, ${themeMix(main, dark ? 12 : 8)} 40%, ${themeMix(secondary, dark ? 10 : 7)} 68%, ${base} 96%)`,
    ].join(","),
    backgroundSize: "170% 170%, 180% 180%, 320% 320%",
    animation: `${gradientFlow} 28s ease-in-out infinite`,
    transition: "background-color 350ms ease",
    "&::before, &::after": {
      content: '""',
      position: "absolute",
      width: { xs: "78vmax", md: "58vmax" },
      height: { xs: "78vmax", md: "58vmax" },
      borderRadius: "50%",
      filter: "blur(72px)",
      pointerEvents: "none",
      willChange: "transform",
      zIndex: -1,
    },
    "&::before": {
      top: "-38vmax",
      left: "-28vmax",
      background: `radial-gradient(circle, ${themeMix(main, dark ? 30 : 24)} 0%, transparent 66%)`,
      animation: `${firstGlowFlow} 24s ease-in-out infinite`,
    },
    "&::after": {
      right: "-30vmax",
      bottom: "-40vmax",
      background: `radial-gradient(circle, ${themeMix(secondary, dark ? 24 : 18)} 0%, transparent 66%)`,
      animation: `${secondGlowFlow} 31s ease-in-out infinite`,
    },
    "@media (prefers-reduced-motion: reduce)": {
      "&, &::before, &::after, & *, & *::before, & *::after": {
        animation: "none !important",
        transition: "none !important",
      },
      "& .login-note-front": { transform: "none !important" },
    },
  } as const;
}
