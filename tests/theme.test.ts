import { expect, it } from 'vitest';
import { createPanelMuiTheme, hueColor, normalizeHue } from '../src/client/theme';

it('normalizes Mizuki-style theme hues and creates HSL colors', () => {
  expect(normalizeHue(-20)).toBe(0);
  expect(normalizeHue(240.4)).toBe(240);
  expect(normalizeHue(999)).toBe(360);
  expect(normalizeHue(Number.NaN)).toBe(240);
  expect(hueColor(210, 48)).toBe('hsl(210 72% 48%)');
});

it('keeps theme-colored controls white with a visible hover background in both modes', () => {
  for (const mode of ['light', 'dark'] as const) {
    const theme = createPanelMuiTheme(180, mode);
    expect(theme.palette.primary.contrastText).toBe('#fff');
    expect(theme.palette.secondary.contrastText).toBe('#fff');

    const buttonRoot = theme.components?.MuiButton?.styleOverrides?.root;
    expect(typeof buttonRoot).toBe('function');
    const buttonStyle = (buttonRoot as unknown as (props: { ownerState: { variant: string; color: string } }) => Record<string, unknown>)({
      ownerState: { variant: 'contained', color: 'primary' }
    });
    expect(buttonStyle.color).toBe('#fff');
    expect(buttonStyle['&:hover']).toMatchObject({ color: '#fff', backgroundColor: theme.palette.primary.dark });

    const navigation = theme.components?.MuiListItemButton?.styleOverrides?.root as Record<string, unknown>;
    expect(navigation['&.active']).toMatchObject({ color: '#fff', backgroundColor: theme.palette.primary.main });
    expect(navigation['&.active:hover']).toMatchObject({ color: '#fff', backgroundColor: theme.palette.primary.dark });
  }
});
