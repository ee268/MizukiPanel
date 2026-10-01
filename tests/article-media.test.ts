import { expect, it } from "vitest";
import {
  articleMediaReference,
  mediaPreviewUrl,
  validImageReference,
} from "../src/client/articles/article-media";
import { validLinkReference } from "../src/client/articles/article-link";
import type { MediaItem } from "../src/client/types";

const publicImage: MediaItem = {
  scope: "public",
  path: "covers/banner.png",
  size: 1,
  modified: "2026-10-01T00:00:00.000Z",
  reference: "/images/covers/banner.png",
  referencedBy: [],
};

const articleImage: MediaItem = {
  ...publicImage,
  scope: "article",
  path: "notes/assets/photo.png",
  reference: "./assets/photo.png",
};

it("creates article-relative media references without using another article's stored reference", () => {
  expect(articleMediaReference("notes/post.md", publicImage)).toBe("/images/covers/banner.png");
  expect(articleMediaReference("notes/post.md", articleImage)).toBe("./assets/photo.png");
  expect(articleMediaReference("guides/post.md", articleImage)).toBe("../notes/assets/photo.png");
});

it("serves project images through the media API while retaining Markdown paths", () => {
  expect(mediaPreviewUrl("notes/post.md", "./assets/photo.png")).toBe(
    "/api/media/file?scope=article&path=notes%2Fassets%2Fphoto.png",
  );
  expect(mediaPreviewUrl("notes/post.md", "/images/covers/banner.png")).toBe(
    "/api/media/file?scope=public&path=covers%2Fbanner.png",
  );
  expect(mediaPreviewUrl("notes/post.md", "../../../escape.png")).toBeNull();
  expect(validImageReference("javascript:alert(1)")).toBe(false);
  expect(validImageReference("https://example.com/image.png")).toBe(true);
});

it("accepts safe link targets and rejects active URL schemes", () => {
  expect(validLinkReference("https://example.com/post")).toBe(true);
  expect(validLinkReference("./related")).toBe(true);
  expect(validLinkReference("mailto:hello@example.com")).toBe(true);
  expect(validLinkReference("javascript:alert(1)")).toBe(false);
  expect(validLinkReference("//example.com")).toBe(false);
});
