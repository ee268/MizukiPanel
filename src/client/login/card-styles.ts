import type { SxProps, Theme } from "@mui/material";

type CardSx = Exclude<SxProps<Theme>, readonly unknown[]>;

export const loginCardStyles = {
  surface: {
    borderRadius: "8px 8px 26px 8px",
    bgcolor: "background.paper",
    borderColor: "divider",
    borderLeft: "3px solid var(--mui-palette-primary-main)",
    boxShadow: "0 14px 36px color-mix(in srgb, var(--mui-palette-text-primary) 5%, transparent)",
    "&::after": {
      content: '""',
      position: "absolute",
      right: 0,
      bottom: 0,
      width: 24,
      height: 24,
      clipPath: "polygon(100% 0, 0 100%, 100% 100%)",
      bgcolor:
        "color-mix(in srgb, var(--mui-palette-primary-main) 18%, var(--mui-palette-background-paper))",
      pointerEvents: "none",
    },
  },
  heading: { letterSpacing: "-.02em", fontWeight: 650 },
  description: { pb: 1, borderBottom: "1px solid", borderColor: "divider" },
  input: {
    "& .MuiOutlinedInput-root": { borderRadius: 0, bgcolor: "transparent", px: 0 },
    "& .MuiOutlinedInput-notchedOutline": {
      border: 0,
      borderBottom: "1px solid",
      borderColor: "divider",
    },
    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      border: 0,
      borderBottom: "2px solid",
      borderColor: "primary.main",
    },
    "& .MuiInputBase-input": { px: 0.5 },
    "& .MuiInputLabel-root": { transform: "translate(4px, 9px) scale(1)" },
    "& .MuiInputLabel-shrink": { transform: "translate(4px, -9px) scale(.75)" },
  },
  button: { borderRadius: "8px", alignSelf: "flex-end", width: "62%", minWidth: 144 },
} satisfies Record<string, CardSx>;
