import { expect, it } from "vitest";
import { draftBody, hasSourceHeaderChange, rebaseBody } from "../src/client/articles/article-draft";

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
