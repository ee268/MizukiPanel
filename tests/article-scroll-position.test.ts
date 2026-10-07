import { expect, it } from "vitest";
import {
  sourceYForVisualY,
  visualYForSourceY,
  type SourceMeasure,
  type VisualAnchor,
} from "../src/client/articles/article-scroll-anchors";
import {
  articleScrollProgress,
  articleScrollTargetY,
} from "../src/client/articles/article-scroll-position";

it("keeps the same reading progress when source and visual content have different heights", () => {
  const viewportHeight = 900;
  const anchorOffset = 160;
  const sourceTop = 400;
  const visualTop = 260;
  const sourceHeight = 3000;
  const visualHeight = 1800;
  const sourceScrollY = 1500;

  const progress = articleScrollProgress(
    sourceScrollY + anchorOffset,
    sourceTop,
    sourceHeight,
    viewportHeight,
    anchorOffset,
  );
  const visualScrollY = articleScrollTargetY(
    progress,
    visualTop,
    visualHeight,
    viewportHeight,
    anchorOffset,
  );

  expect(
    articleScrollProgress(
      visualScrollY + anchorOffset,
      visualTop,
      visualHeight,
      viewportHeight,
      anchorOffset,
    ),
  ).toBeCloseTo(progress);
  expect(visualScrollY).toBeLessThan(sourceScrollY);
});

it("aligns the end of a shorter source view with the end of a taller visual view", () => {
  const visualScrollY = articleScrollTargetY(1, 300, 3200, 900, 160);
  const sourceScrollY = articleScrollTargetY(1, 240, 1700, 900, 160);

  expect(visualScrollY + 900).toBe(300 + 3200);
  expect(sourceScrollY + 900).toBe(240 + 1700);
  expect(visualScrollY).toBeGreaterThan(sourceScrollY);
});

it("aligns nearby paragraphs despite a tall rendered image between them", () => {
  const anchors: VisualAnchor[] = [
    { sourceOffset: 0, pageY: 200 },
    { sourceOffset: 50, pageY: 500 },
    { sourceOffset: 51, pageY: 2300 },
    { sourceOffset: 100, pageY: 3300 },
  ];
  const measure: SourceMeasure = {
    pageYAt(offset) {
      return offset <= 50 ? 200 + offset * 24 : 1400 + (offset - 50) * 24;
    },
    dispose() {},
  };

  expect(visualYForSourceY(anchors, measure, 1424)).toBe(2300);
  expect(sourceYForVisualY(anchors, measure, 2300)).toBe(1424);
});
