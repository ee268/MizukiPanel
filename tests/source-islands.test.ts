import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { replaceArticleSegments, segmentArticleSource } from "../src/lib/articles/source-islands";

const frontmatter = "\uFEFF---\r\ntitle: Example\r\ntags: [one, two] # keep\r\n---\r\n";

it("preserves Frontmatter, MDX, directives and untouched source bytes", () => {
  const body = [
    "# Intro\r\n",
    "\r\n",
    "Before [[guide/path|阅读]] and :spoiler[secret].\r\n",
    "\r\n",
    ':::custom{value="a:b"}\r\n',
    "Unknown directive body.\r\n",
    ":::\r\n",
    "\r\n",
    "import Widget from './Widget.astro'\r\n",
    "\r\n",
    "<Widget value={1 + 2}>**inside**</Widget>\r\n",
    "\r\n",
    "Tail.\r\n",
  ].join("");
  const source = frontmatter + body;
  const article = segmentArticleSource(source, "mdx");

  expect(article.mode).toBe("hybrid");
  expect(article.bodyStart).toBe(frontmatter.length);
  expect(article.segments.map((segment) => segment.raw).join("")).toBe(body);
  expect(article.segments.some((segment) => segment.syntax === "wikiLink")).toBe(true);
  expect(article.segments.some((segment) => segment.syntax === "containerDirective")).toBe(true);
  expect(article.segments.some((segment) => segment.syntax === "mdxjsEsm")).toBe(true);
  expect(article.segments.some((segment) => segment.syntax?.startsWith("mdxJsx"))).toBe(true);
  expect(replaceArticleSegments(article, new Map())).toBe(source);

  const editable = article.segments.find((segment) => segment.raw.includes("# Intro"));
  expect(editable).toBeDefined();
  const modified = replaceArticleSegments(
    article,
    new Map([[editable!.id, editable!.raw.replace("# Intro", "# Changed")]]),
  );
  expect(modified).toBe(source.replace("# Intro", "# Changed"));
  expect(modified.startsWith(frontmatter)).toBe(true);

  const component = article.segments.find((segment) => segment.syntax?.startsWith("mdxJsx"))!;
  const changedComponent = replaceArticleSegments(
    article,
    new Map([[component.id, component.raw.replace("1 + 2", "2 + 3")]]),
  );
  expect(changedComponent).toBe(source.replace("1 + 2", "2 + 3"));
});

it("keeps Mizuki code, math, GitHub alerts and unknown directives as source islands", () => {
  const source = [
    "---",
    "title: Syntax",
    "---",
    "",
    "Normal paragraph.",
    "",
    "> [!NOTE]",
    "> Keep this block.",
    "",
    "$$",
    "x^2",
    "$$",
    "",
    "```mermaid",
    "graph TD; A-->B;",
    "```",
    "",
    "```js title=demo.js",
    "const x = 1;",
    "```",
    "",
    ":::unknown",
    "Keep this too.",
    ":::",
    "",
  ].join("\n");
  const article = segmentArticleSource(source, "md");

  expect(article.mode).toBe("hybrid");
  expect(
    article.segments
      .filter((segment) => segment.mode === "source")
      .map((segment) => segment.syntax),
  ).toEqual(
    expect.arrayContaining([
      "githubAdmonition",
      "math",
      "code:mermaid",
      "code:js",
      "containerDirective",
    ]),
  );
  expect(replaceArticleSegments(article, new Map())).toBe(source);

  const mermaid = article.segments.find((segment) => segment.syntax === "code:mermaid")!;
  const modified = replaceArticleSegments(
    article,
    new Map([[mermaid.id, mermaid.raw.replace("A-->B", "A-->C")]]),
  );
  expect(modified).toBe(source.replace("A-->B", "A-->C"));
});

it("falls back to whole source for invalid MDX or missing Frontmatter", () => {
  const invalid = "---\ntitle: Broken\n---\n\n<Widget value={}>\n";
  const parsed = segmentArticleSource(invalid, "mdx");
  expect(parsed.mode).toBe("source");
  expect(parsed.reason).toBeTruthy();
  expect(parsed.segments).toHaveLength(1);
  expect(replaceArticleSegments(parsed, new Map())).toBe(invalid);

  const noFrontmatter = "# Hello\n";
  expect(segmentArticleSource(noFrontmatter, "md").mode).toBe("source");
  const lateFrontmatter = "Intro\n---\ntitle: Late\n---\nBody\n";
  expect(segmentArticleSource(lateFrontmatter, "md").mode).toBe("source");
});

it("protects an unclosed Wiki Link after a complete one", () => {
  const source = "---\ntitle: Wiki\n---\n\n[[valid]] and [[unfinished\n";
  const article = segmentArticleSource(source, "md");
  expect(article.mode).toBe("hybrid");
  expect(article.segments.filter((segment) => segment.syntax === "wikiLink")).toHaveLength(1);
  expect(article.segments.some((segment) => segment.syntax === "unclosedWikiLink")).toBe(true);
  expect(replaceArticleSegments(article, new Map())).toBe(source);
});

it("keeps inline MDX expressions and raw HTML out of editable Markdown spans", () => {
  const mdx = segmentArticleSource("---\ntitle: Inline\n---\n\nValue: {count + 1}.\n", "mdx");
  expect(mdx.segments.some((segment) => segment.syntax === "mdxTextExpression")).toBe(true);
  expect(replaceArticleSegments(mdx, new Map())).toBe(mdx.source);

  const md = segmentArticleSource('---\ntitle: HTML\n---\n\n<div data-x="1">raw</div>\n', "md");
  expect(md.segments.some((segment) => segment.syntax === "html")).toBe(true);
  expect(replaceArticleSegments(md, new Map())).toBe(md.source);
});

it("keeps a malformed standalone image tag together across parsed URL nodes", () => {
  const raw = '<img src="https://example.com/photo.png" alt="A" /';
  const source = `---\ntitle: Image draft\n---\n\nBefore.\n\n${raw}\n\nAfter.\n`;
  const article = segmentArticleSource(source, "md");
  const draft = article.segments.find((segment) => segment.syntax === "htmlImageDraft");

  expect(article.mode).toBe("hybrid");
  expect(draft?.raw).toBe(raw);
  expect(replaceArticleSegments(article, new Map())).toBe(source);

  const code = segmentArticleSource(`---\ntitle: Code\n---\n\n\`\`\`html\n${raw}\n\`\`\`\n`, "md");
  expect(code.segments.some((segment) => segment.syntax === "htmlImageDraft")).toBe(false);

  const crlf = segmentArticleSource(`---\r\ntitle: Image draft\r\n---\r\n\r\n${raw}\r\n`, "md");
  expect(crlf.segments.find((segment) => segment.syntax === "htmlImageDraft")?.raw).toBe(raw);
  expect(replaceArticleSegments(crlf, new Map())).toBe(crlf.source);
});

it("rejects replacements for unknown or tampered ranges", () => {
  const article = segmentArticleSource("---\ntitle: Safe\n---\n\nHello.", "md");
  expect(() => replaceArticleSegments(article, new Map([[99, "oops"]]))).toThrow();
  article.segments[0].raw = "tampered";
  expect(() => replaceArticleSegments(article, new Map())).toThrow();
});

const realPost = path.resolve(process.cwd(), "../Mizuki/src/content/posts/Qt框架功能概述.md");
it.skipIf(!existsSync(realPost))(
  "round trips a real Mizuki article without writing it",
  async () => {
    const source = await readFile(realPost, "utf8");
    const article = segmentArticleSource(source, "md");
    expect(article.mode).toBe("hybrid");
    expect(replaceArticleSegments(article, new Map())).toBe(source);
  },
);
