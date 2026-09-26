import { expect, it } from 'vitest';
import { hueColor, normalizeHue } from '../src/client/theme';

it('normalizes Mizuki-style theme hues and creates HSL colors', () => {
  expect(normalizeHue(-20)).toBe(0);
  expect(normalizeHue(240.4)).toBe(240);
  expect(normalizeHue(999)).toBe(360);
  expect(normalizeHue(Number.NaN)).toBe(240);
  expect(hueColor(210, 48)).toBe('hsl(210 72% 48%)');
});
