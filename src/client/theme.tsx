import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

export type PanelColorMode = "light" | "dark" | "system";

export interface PanelThemeSettings {
  hue: number;
  mode: PanelColorMode;
}

interface PanelThemeContextValue extends PanelThemeSettings {
  resolvedMode: "light" | "dark";
  setHue: (hue: number) => void;
  setMode: (mode: PanelColorMode) => void;
  reset: () => void;
}

const storageKey = "mizuki-panel-theme";
export const defaultPanelTheme: PanelThemeSettings = { hue: 240, mode: "system" };

export function normalizeHue(value: number): number {
  if (!Number.isFinite(value)) return defaultPanelTheme.hue;
  return Math.min(360, Math.max(0, Math.round(value)));
}

export function hueColor(hue: number, lightness = 52): string {
  return `hsl(${normalizeHue(hue)} 72% ${lightness}%)`;
}

function readSettings(): PanelThemeSettings {
  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKey) ?? "{}",
    ) as Partial<PanelThemeSettings>;
    const mode =
      stored.mode === "light" || stored.mode === "dark" || stored.mode === "system"
        ? stored.mode
        : defaultPanelTheme.mode;
    return { hue: normalizeHue(stored.hue ?? defaultPanelTheme.hue), mode };
  } catch {
    return defaultPanelTheme;
  }
}

const PanelThemeContext = createContext<PanelThemeContextValue | null>(null);

export function usePanelTheme(): PanelThemeContextValue {
  const value = useContext(PanelThemeContext);
  if (!value) throw new Error("usePanelTheme must be used inside PanelThemeProvider");
  return value;
}

export function createPanelMuiTheme(hue: number, resolvedMode: "light" | "dark") {
  const primaryMain = hueColor(hue, resolvedMode === "dark" ? 64 : 48);
  const primaryHover = hueColor(hue, resolvedMode === "dark" ? 54 : 40);
  const secondaryHue = (hue + 125) % 360;
  const secondaryMain = hueColor(secondaryHue, resolvedMode === "dark" ? 62 : 42);
  const secondaryHover = hueColor(secondaryHue, resolvedMode === "dark" ? 52 : 34);
  const themeContrast = resolvedMode === "dark" ? "#000" : "#fff";
  const scrollbarTrack = resolvedMode === "dark" ? "#111318" : "#e5e7ed";
  return createTheme({
    cssVariables: true,
    palette: {
      mode: resolvedMode,
      primary: { main: primaryMain, dark: primaryHover, contrastText: themeContrast },
      secondary: { main: secondaryMain, dark: secondaryHover, contrastText: themeContrast },
      background:
        resolvedMode === "dark"
          ? { default: "#111318", paper: "#191c23" }
          : { default: "#f5f6fa", paper: "#ffffff" },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: "var(--mizuki-panel-font-sans)",
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 650 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          "*": {
            scrollbarColor: primaryMain + " " + scrollbarTrack,
            scrollbarWidth: "thin",
          },
          "*::-webkit-scrollbar": { width: 10, height: 10 },
          "*::-webkit-scrollbar-track": { backgroundColor: scrollbarTrack },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: primaryMain,
            border: "2px solid " + scrollbarTrack,
            borderRadius: 999,
          },
          "*::-webkit-scrollbar-thumb:hover": { backgroundColor: primaryHover },
          "*::-webkit-scrollbar-corner": { backgroundColor: scrollbarTrack },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: ({ ownerState }) => ({
            textTransform: "none",
            fontWeight: 600,
            ...(ownerState.variant === "contained" &&
            (ownerState.color === "primary" || ownerState.color === undefined)
              ? {
                  color: themeContrast,
                  backgroundColor: primaryMain,
                  "&:hover": { color: themeContrast, backgroundColor: primaryHover },
                }
              : {}),
            ...(ownerState.variant === "contained" && ownerState.color === "secondary"
              ? {
                  color: themeContrast,
                  backgroundColor: secondaryMain,
                  "&:hover": { color: themeContrast, backgroundColor: secondaryHover },
                }
              : {}),
          }),
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            "&.active": {
              color: themeContrast,
              backgroundColor: primaryMain,
              "& .MuiListItemIcon-root": { color: "inherit" },
            },
            "&.active:hover": { color: themeContrast, backgroundColor: primaryHover },
          },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiTextField: { defaultProps: { size: "small" } },
    },
  });
}
export function PanelThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(readSettings);
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [settings]);
  const resolvedMode = settings.mode === "system" ? (systemDark ? "dark" : "light") : settings.mode;
  const theme = useMemo(
    () => createPanelMuiTheme(settings.hue, resolvedMode),
    [resolvedMode, settings.hue],
  );
  const value = useMemo<PanelThemeContextValue>(
    () => ({
      ...settings,
      resolvedMode,
      setHue: (hue) => setSettings((current) => ({ ...current, hue: normalizeHue(hue) })),
      setMode: (mode) => setSettings((current) => ({ ...current, mode })),
      reset: () => setSettings(defaultPanelTheme),
    }),
    [resolvedMode, settings],
  );
  return (
    <PanelThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </PanelThemeContext.Provider>
  );
}
