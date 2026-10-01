import { expect, it } from "vitest";
import {
  draftBody,
  hasSourceHeaderChange,
  preserveSegmentBoundary,
  rebaseBody,
} from "../src/client/articles/article-draft";
import { replaceArticleSegments, segmentArticleSource } from "../src/lib/articles/source-islands";

const original =
  "\uFEFF---\r\ntitle: Original\r\ntags: [one, two] # keep\r\n---\r\n# Title\r\n\r\n:::note\r\nKeep raw\r\n:::\r\n";

it("keeps visual edits in the body while Frontmatter is saved separately", () => {
  const draft = original.replace("# Title", "# Updated");
  const savedFrontmatter = original.replace("title: Original", "title: Saved");

  expect(draftBody(draft)).toBe("# Updated\r\n\r\n:::note\r\nKeep raw\r\n:::\r\n");
  expect(hasSourceHeaderChange(draft, original)).toBe(false);
  expect(rebaseBody(savedFrontmatter, draft)).toBe(
    savedFrontmatter.replace("# Title", "# Updated"),
  );
  expect(hasSourceHeaderChange(savedFrontmatter, original)).toBe(true);
});

it("only replaces an edited Markdown segment and retains protected source bytes", () => {
  const parsed = segmentArticleSource(original, "md");
  const editable = parsed.segments.find((segment) => segment.mode === "editable")!;
  const protectedSegment = parsed.segments.find((segment) => segment.mode === "source")!;
  const replacement = preserveSegmentBoundary(editable.raw, "# Updated");
  const next = replaceArticleSegments(parsed, new Map([[editable.id, replacement]]));

  expect(next).toBe(original.replace("# Title", "# Updated"));
  expect(next).toContain(protectedSegment.raw);
});

it("preserves spaces against inline source islands", () => {
  expect(preserveSegmentBoundary("Before ", "Before", false, true)).toBe("Before ");
  expect(preserveSegmentBoundary(" after", "after", true, false)).toBe(" after");
});
