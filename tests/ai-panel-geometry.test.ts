import { expect, it } from "vitest";
import { fitPanel, resizeDirections, resizePanel } from "../src/client/ai/panel-geometry";
const bounds = { left: 8, top: 73, right: 1272, bottom: 892 };
const rect = { left: 400, top: 200, width: 440, height: 500 };
it("recovers from temporarily collapsed viewports without retaining invalid panel dimensions", () => {
  expect(fitPanel({ ...rect, width: -16, height: 8 }, bounds)).toEqual({
    left: 400,
    top: 200,
    width: 320,
    height: 360,
  });
  expect(fitPanel(rect, { left: 8, top: 8, right: -8, bottom: 0 })).toEqual(rect);
  const narrow = fitPanel(rect, { left: 8, top: 73, right: 20, bottom: 85 });
  expect(narrow).toMatchObject({ width: 12, height: 12 });
  expect(fitPanel(narrow, bounds)).toMatchObject({ width: 320, height: 360 });
});
it("resizes every edge and corner while anchoring the opposite edges", () => {
  for (const direction of resizeDirections) {
    const next = resizePanel(rect, direction, 30, 40, bounds);
    expect(next.left).toBe(rect.left + (direction.includes("w") ? 30 : 0));
    expect(next.top).toBe(rect.top + (direction.includes("n") ? 40 : 0));
    expect(next.left + next.width).toBe(
      rect.left + rect.width + (direction.includes("e") ? 30 : 0),
    );
    expect(next.top + next.height).toBe(
      rect.top + rect.height + (direction.includes("s") ? 40 : 0),
    );
  }
});
it("prevents inverted dimensions and bounds all resizing above the app header", () => {
  for (const direction of resizeDirections)
    for (const delta of [-10000, 10000]) {
      const next = resizePanel(rect, direction, delta, delta, bounds);
      expect(next.width).toBeGreaterThanOrEqual(320);
      expect(next.height).toBeGreaterThanOrEqual(360);
      expect(next.left).toBeGreaterThanOrEqual(bounds.left);
      expect(next.top).toBeGreaterThanOrEqual(bounds.top);
      expect(next.left + next.width).toBeLessThanOrEqual(bounds.right);
      expect(next.top + next.height).toBeLessThanOrEqual(bounds.bottom);
    }
});
it("fits dragging and resized windows, including viewports smaller than minimum dimensions", () => {
  const small = { left: 8, top: 73, right: 292, bottom: 320 };
  const fitted = fitPanel(rect, small);
  expect(fitted).toEqual({ left: 8, top: 73, width: 284, height: 247 });
  for (const direction of resizeDirections)
    expect(resizePanel(fitted, direction, 10000, -10000, small)).toEqual(fitted);
  expect(fitPanel({ ...rect, left: -1000, top: -1000 }, bounds)).toEqual({
    ...rect,
    left: 8,
    top: 73,
  });
});
