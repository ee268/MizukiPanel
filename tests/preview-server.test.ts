import { expect, it } from "vitest";

import { previewExitError } from "../src/lib/server/preview";

it("does not report a user-requested preview stop as a failure", () => {
  expect(previewExitError(1, true)).toBeNull();
  expect(previewExitError(null, true)).toBeNull();
});

it("reports an unexpected non-zero Astro exit", () => {
  expect(previewExitError(1, false)).toBe("Astro 预览异常退出，退出码 1");
  expect(previewExitError(0, false)).toBeNull();
});
