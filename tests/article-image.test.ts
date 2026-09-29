import { describe, expect, it } from "vitest";
import { articleImageUrl } from "../src/client/articles/article-image";

describe("articleImageUrl", () => {
  it("keeps remote image URLs", () => {
    expect(articleImageUrl("https://example.com/cover.webp", "post.md")).toBe(
      "https://example.com/cover.webp",
    );
  });

  it("maps public and article-local images to the media API", () => {
    expect(articleImageUrl("/images/covers/one.webp", "post.md")).toBe(
      "/api/media/file?scope=public&path=covers%2Fone.webp",
    );
    expect(articleImageUrl("./cover.webp", "nested/post.md")).toBe(
      "/api/media/file?scope=article&path=nested%2Fcover.webp",
    );
    expect(articleImageUrl("../shared/cover.webp", "nested/post.md")).toBe(
      "/api/media/file?scope=article&path=shared%2Fcover.webp",
    );
  });

  it("rejects unsupported absolute paths and traversal beyond posts", () => {
    expect(articleImageUrl("/assets/cover.webp", "post.md")).toBeNull();
    expect(articleImageUrl("../../cover.webp", "nested/post.md")).toBeNull();
  });
});
