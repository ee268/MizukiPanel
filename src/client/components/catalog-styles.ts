import type { Theme } from "@mui/material";

export function catalogCardStyles(theme: Theme, iconClass: string) {
  return {
    height: "100%",
    borderRadius: "16px",
    transition: theme.transitions.create(["transform", "box-shadow", "border-color"], {
      duration: 220,
    }),
    "@media (hover: hover) and (pointer: fine)": {
      "&:hover": {
        transform: "translateY(-5px)",
        borderColor: "color-mix(in srgb, var(--mui-palette-primary-main) 60%, transparent)",
        boxShadow: `0 12px 30px color-mix(in srgb, var(--mui-palette-primary-${theme.palette.mode === "dark" ? "light" : "main"}) ${theme.palette.mode === "dark" ? "9%" : "12%"}, transparent)`,
        [`& .${iconClass}`]: { transform: "rotate(-8deg) scale(1.08)" },
      },
    },
    "@media (prefers-reduced-motion: reduce)": {
      transition: "none",
      "&:hover": { transform: "none" },
      [`& .${iconClass}`]: { transition: "none", transform: "none !important" },
    },
  };
}

export function catalogIconStyles(theme: Theme) {
  return {
    width: 40,
    height: 40,
    borderRadius: "12px",
    bgcolor: "color-mix(in srgb, var(--mui-palette-primary-main) 10%, transparent)",
    color: "primary.main",
    transition: theme.transitions.create("transform", { duration: 220 }),
    "& .MuiSvgIcon-root": { fontSize: 24 },
  };
}
