import { describe, expect, it } from "vitest";

import { previewLogTokens, previewLogTone, previewTargetUrl } from "../src/client/preview-log";

describe("previewTargetUrl", () => {
  it("joins a preview base URL and page path", () => {
    expect(previewTargetUrl("http://127.0.0.1:4321/", "/posts/demo/")).toBe(
      "http://127.0.0.1:4321/posts/demo/",
    );
    expect(previewTargetUrl("http://127.0.0.1:4321", "about/")).toBe(
      "http://127.0.0.1:4321/about/",
    );
  });
});

describe("preview log highlighting", () => {
  it("classifies error, warning, and successful startup lines", () => {
    expect(previewLogTone("[12:00:00] ERROR failed to start")).toBe("error");
    expect(previewLogTone("[12:00:00] WARN port is in use")).toBe("warning");
    expect(previewLogTone("[12:00:00] ready in 120 ms")).toBe("success");
  });

  it("highlights JSON log keys, values, numbers, and punctuation", () => {
    const tokens = previewLogTokens('{"message":"ready","pid":4321}');

    expect(tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '"message"', tone: "warning" }),
        expect.objectContaining({ text: '"ready"', tone: "accent" }),
        expect.objectContaining({ text: "4321", tone: "warning" }),
        expect.objectContaining({ text: "{", tone: "muted" }),
      ]),
    );
  });
  it("assigns distinct colors to timestamps, startup words, and URLs", () => {
    const tokens = previewLogTokens(
      "[12:00:00] Astro ready at http://127.0.0.1:4321/",
    );

    expect(tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "[12:00:00]", tone: "muted" }),
        expect.objectContaining({ text: "Astro", tone: "accent" }),
        expect.objectContaining({ text: "ready", tone: "success" }),
        expect.objectContaining({ text: "http://127.0.0.1:4321/", tone: "accent" }),
      ]),
    );
  });
});
