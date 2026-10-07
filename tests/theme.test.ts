import { expect, it } from "vitest";
import { createPanelMuiTheme, hueColor, normalizeHue } from "../src/client/theme";

it("normalizes Mizuki-style theme hues and creates HSL colors", () => {
  expect(normalizeHue(-20)).toBe(0);
  expect(normalizeHue(240.4)).toBe(240);
  expect(normalizeHue(999)).toBe(360);
  expect(normalizeHue(Number.NaN)).toBe(240);
  expect(hueColor(210, 48)).toBe("hsl(210 72% 48%)");
});

it("keeps theme colors and contrast fixed across light and dark modes", () => {
  const lightTheme = createPanelMuiTheme(180, "light");
  const darkTheme = createPanelMuiTheme(180, "dark");
  expect(lightTheme.palette.primary.main).toBe(hueColor(180, 48));
  expect(lightTheme.palette.primary.dark).toBe(hueColor(180, 40));
  expect(lightTheme.palette.secondary.main).toBe(hueColor(305, 42));
  expect(lightTheme.palette.secondary.dark).toBe(hueColor(305, 34));
  for (const color of ["primary", "secondary"] as const) {
    expect(darkTheme.palette[color].main).toBe(lightTheme.palette[color].main);
    expect(darkTheme.palette[color].dark).toBe(lightTheme.palette[color].dark);
  }
  expect(darkTheme.palette.background.default).not.toBe(lightTheme.palette.background.default);
  for (const mode of ["light", "dark"] as const) {
    const theme = createPanelMuiTheme(180, mode);
    expect(theme.vars?.palette.primary.main).toContain("--mui-palette-primary-main");
    expect(theme.vars?.palette.primary.dark).toContain("--mui-palette-primary-dark");
    const expectedText = "#fff";
    expect(theme.palette.primary.contrastText).toBe(expectedText);
    expect(theme.palette.secondary.contrastText).toBe(expectedText);

    const buttonRoot = theme.components?.MuiButton?.styleOverrides?.root;
    expect(typeof buttonRoot).toBe("function");
    const buttonStyle = (
      buttonRoot as unknown as (props: {
        ownerState: { variant: string; color: string };
      }) => Record<string, unknown>
    )({
      ownerState: { variant: "contained", color: "primary" },
    });
    expect(buttonStyle.color).toBe(expectedText);
    expect(buttonStyle["&:hover"]).toMatchObject({
      color: expectedText,
      backgroundColor: "var(--mui-palette-primary-dark)",
    });

    const navigation = theme.components?.MuiListItemButton?.styleOverrides?.root as Record<
      string,
      unknown
    >;
    expect(navigation["&.active"]).toMatchObject({
      color: expectedText,
      backgroundColor: "var(--mui-palette-primary-main)",
    });
    expect(navigation["&.active:hover"]).toMatchObject({
      color: expectedText,
      backgroundColor: "var(--mui-palette-primary-dark)",
    });
  }
});
it("styles every scrollbar with the current theme color", () => {
  for (const mode of ["light", "dark"] as const) {
    const theme = createPanelMuiTheme(180, mode);
    const overrides = theme.components?.MuiCssBaseline?.styleOverrides as Record<
      string,
      Record<string, unknown>
    >;
    const expectedTrack = mode === "dark" ? "#111318" : "#e5e7ed";

    expect(overrides["*"]).toMatchObject({
      scrollbarColor: `var(--mui-palette-primary-main) ${expectedTrack}`,
      scrollbarWidth: "thin",
    });
    expect(overrides["*::-webkit-scrollbar-thumb"]).toMatchObject({
      backgroundColor: "var(--mui-palette-primary-main)",
      border: `2px solid ${expectedTrack}`,
    });
    expect(overrides["*::-webkit-scrollbar-thumb:hover"]).toMatchObject({
      backgroundColor: "var(--mui-palette-primary-dark)",
    });
  }
});
