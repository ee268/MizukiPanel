import { expect, it } from 'vitest';
import { createPanelMuiTheme, hueColor, normalizeHue } from '../src/client/theme';

it('normalizes Mizuki-style theme hues and creates HSL colors', () => {
  expect(normalizeHue(-20)).toBe(0);
  expect(normalizeHue(240.4)).toBe(240);
  expect(normalizeHue(999)).toBe(360);
  expect(normalizeHue(Number.NaN)).toBe(240);
  expect(hueColor(210, 48)).toBe('hsl(210 72% 48%)');
});

it('uses mode-specific text with a visible hover background for theme-colored controls', () => {
  for (const mode of ['light', 'dark'] as const) {
    const theme = createPanelMuiTheme(180, mode);
    const expectedText = mode === 'dark' ? '#000' : '#fff';
    expect(theme.palette.primary.contrastText).toBe(expectedText);
    expect(theme.palette.secondary.contrastText).toBe(expectedText);

    const buttonRoot = theme.components?.MuiButton?.styleOverrides?.root;
    expect(typeof buttonRoot).toBe('function');
    const buttonStyle = (buttonRoot as unknown as (props: { ownerState: { variant: string; color: string } }) => Record<string, unknown>)({
      ownerState: { variant: 'contained', color: 'primary' }
    });
    expect(buttonStyle.color).toBe(expectedText);
    expect(buttonStyle['&:hover']).toMatchObject({ color: expectedText, backgroundColor: theme.palette.primary.dark });

    const navigation = theme.components?.MuiListItemButton?.styleOverrides?.root as Record<string, unknown>;
    expect(navigation['&.active']).toMatchObject({ color: expectedText, backgroundColor: theme.palette.primary.main });
    expect(navigation['&.active:hover']).toMatchObject({ color: expectedText, backgroundColor: theme.palette.primary.dark });
  }
});
it('styles every scrollbar with the current theme color', () => {
  for (const mode of ['light', 'dark'] as const) {
    const theme = createPanelMuiTheme(180, mode);
    const overrides = theme.components?.MuiCssBaseline?.styleOverrides as Record<string, Record<string, unknown>>;
    const expectedTrack = mode === 'dark' ? '#111318' : '#e5e7ed';

    expect(overrides['*']).toMatchObject({
      scrollbarColor: `${theme.palette.primary.main} ${expectedTrack}`,
      scrollbarWidth: 'thin'
    });
    expect(overrides['*::-webkit-scrollbar-thumb']).toMatchObject({
      backgroundColor: theme.palette.primary.main,
      border: `2px solid ${expectedTrack}`
    });
    expect(overrides['*::-webkit-scrollbar-thumb:hover']).toMatchObject({
      backgroundColor: theme.palette.primary.dark
    });
  }
});
