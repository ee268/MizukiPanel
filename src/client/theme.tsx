import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { PersonalSettingsProvider, usePersonalSettings } from "./settings/PersonalSettingsProvider";
import { panelFontFamilies } from "./font-families";
import { defaultPanelHue } from "../shared/panel-settings";

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

export const defaultPanelTheme: PanelThemeSettings = { hue: defaultPanelHue, mode: "system" };

export function normalizeHue(value: number): number {
  if (!Number.isFinite(value)) return defaultPanelTheme.hue;
  return Math.min(360, Math.max(0, Math.round(value)));
}

export function hueColor(hue: number, lightness = 52): string {
  return `hsl(${normalizeHue(hue)} 72% ${lightness}%)`;
}

const PanelThemeContext = createContext<PanelThemeContextValue | null>(null);

export function usePanelTheme(): PanelThemeContextValue {
  const value = useContext(PanelThemeContext);
  if (!value) throw new Error("usePanelTheme must be used inside PanelThemeProvider");
  return value;
}

export function createPanelMuiTheme(hue: number, resolvedMode: "light" | "dark", fontSize = 14) {
  const primaryMain = hueColor(hue, 48);
  const primaryHover = hueColor(hue, 40);
  const secondaryHue = (hue + 125) % 360;
  const secondaryMain = hueColor(secondaryHue, 42);
  const secondaryHover = hueColor(secondaryHue, 34);
  const themeContrast = "#fff";
  const scrollbarTrack = resolvedMode === "dark" ? "#111318" : "#e5e7ed";
  const primaryMainVariable = "var(--mui-palette-primary-main)";
  const primaryHoverVariable = "var(--mui-palette-primary-dark)";
  const secondaryMainVariable = "var(--mui-palette-secondary-main)";
  const secondaryHoverVariable = "var(--mui-palette-secondary-dark)";
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
      fontSize,
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 650 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          "*": {
            scrollbarColor: primaryMainVariable + " " + scrollbarTrack,
            scrollbarWidth: "thin",
          },
          "*::-webkit-scrollbar": { width: 10, height: 10 },
          "*::-webkit-scrollbar-track": { backgroundColor: scrollbarTrack },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: primaryMainVariable,
            border: "2px solid " + scrollbarTrack,
            borderRadius: 999,
          },
          "*::-webkit-scrollbar-thumb:hover": { backgroundColor: primaryHoverVariable },
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
                  backgroundColor: primaryMainVariable,
                  "&:hover": { color: themeContrast, backgroundColor: primaryHoverVariable },
                }
              : {}),
            ...(ownerState.variant === "contained" && ownerState.color === "secondary"
              ? {
                  color: themeContrast,
                  backgroundColor: secondaryMainVariable,
                  "&:hover": { color: themeContrast, backgroundColor: secondaryHoverVariable },
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
              backgroundColor: primaryMainVariable,
              "& .MuiListItemIcon-root": { color: "inherit" },
            },
            "&.active:hover": { color: themeContrast, backgroundColor: primaryHoverVariable },
          },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiTextField: { defaultProps: { size: "small" } },
    },
  });
}
export function PanelThemeProvider({ children }: { children: ReactNode }) {
  return (
    <PersonalSettingsProvider>
      <PanelThemeController>{children}</PanelThemeController>
    </PersonalSettingsProvider>
  );
}
function PanelThemeController({ children }: { children: ReactNode }) {
  const preferences = usePersonalSettings();
  const settings = preferences.effective.appearance;
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
    document.documentElement.style.setProperty(
      "--mizuki-panel-font-sans",
      panelFontFamilies[settings.font].body,
    );
    document.documentElement.style.setProperty(
      "--mizuki-panel-font-mono",
      panelFontFamilies[settings.font].code,
    );
  }, [settings.font]);
  const resolvedMode = settings.mode === "system" ? (systemDark ? "dark" : "light") : settings.mode;
  const theme = useMemo(
    () => createPanelMuiTheme(settings.hue, resolvedMode, settings.fontSize),
    [resolvedMode, settings.hue, settings.fontSize],
  );
  const value = useMemo<PanelThemeContextValue>(
    () => ({
      ...settings,
      resolvedMode,
      setHue: (hue) => preferences.quickAppearance({ hue: normalizeHue(hue) }),
      setMode: (mode) => preferences.quickAppearance({ mode }),
      reset: () => preferences.quickAppearance(defaultPanelTheme),
    }),
    [resolvedMode, settings, preferences.quickAppearance],
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
