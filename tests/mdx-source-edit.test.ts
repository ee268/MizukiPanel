import { expect, it } from "vitest";
import { sourceCardLabel, validateSourceCardEdit } from "../src/lib/articles/mdx-source-edit";
import { collectSourceIslandEdits } from "../src/lib/articles/source-island-edits";
import { replaceArticleSegments, segmentArticleSource } from "../src/lib/articles/source-islands";
import { validateArticleBody } from "../src/lib/server/article-body-validation";

const header = "\uFEFF---\r\ntitle: Mixed MDX\r\ntags: [one, two] # preserve\r\n---\r\n";
const mdxBody = [
  "\r\n",
  "import Widget from './Widget.astro'\r\n",
  "export const count = 2\r\n",
  "\r\n",
  "# Introduction\r\n",
  "\r\n",
  "Before {count + 1} after.\r\n",
  'Inline <Badge tone="warm" /> suffix.\r\n',
  "\r\n",
  "{count * 2}\r\n",
  "\r\n",
  "<Widget value={count + 1}>\r\n",
  "\r\n",
  "**inner Markdown**\r\n",
  "\r\n",
  "</Widget>\r\n",
  "\r\n",
  "## Tail\r\n",
].join("");

it("keeps ESM, expressions, and nested JSX beside editable Markdown without rewriting source", async () => {
  const source = header + mdxBody;
  const article = segmentArticleSource(source, "mdx");
  expect(article.mode).toBe("hybrid");
  expect(article.segments.map((segment) => segment.raw).join("")).toBe(mdxBody);
  expect(replaceArticleSegments(article, new Map())).toBe(source);

  const syntax = article.segments
    .filter((segment) => segment.mode === "source")
    .map((segment) => segment.syntax);
  expect(syntax).toEqual(
    expect.arrayContaining([
      "mdxjsEsm",
      "mdxTextExpression",
      "mdxJsxTextElement",
      "mdxFlowExpression",
      "mdxJsxFlowElement",
    ]),
  );
  expect(
    article.segments.some(
      (segment) => segment.mode === "editable" && segment.raw.includes("# Introduction"),
    ),
  ).toBe(true);
  expect(
    article.segments.some(
      (segment) => segment.mode === "editable" && segment.raw.includes("## Tail"),
    ),
  ).toBe(true);

  const expression = article.segments.find((segment) => segment.syntax === "mdxTextExpression")!;
  const edited = validateSourceCardEdit(article, expression, "{count + 2}");
  expect(edited).toEqual({ source: "{count + 2}", reason: null });
  const draft = replaceArticleSegments(article, new Map([[expression.id, edited.source!]]));
  expect(draft).toBe(source.replace("{count + 1} after", "{count + 2} after"));
  expect(draft.startsWith(header)).toBe(true);
  const edits = collectSourceIslandEdits(source, draft, "mdx");
  expect(edits).toEqual([{ id: expression.id, source: "{count + 2}" }]);
  await expect(
    validateArticleBody(source, draft.slice(article.bodyStart), "mdx", edits),
  ).resolves.toBe(draft);
});

it("edits JSX and ESM only when node type and surrounding ranges remain stable", () => {
  const article = segmentArticleSource(header + mdxBody, "mdx");
  const jsx = article.segments.find((segment) => segment.syntax === "mdxJsxFlowElement")!;
  const inlineJsx = article.segments.find((segment) => segment.syntax === "mdxJsxTextElement")!;
  const esm = article.segments.find((segment) => segment.syntax === "mdxjsEsm")!;
  expect(sourceCardLabel(jsx)).toBe("MDX JSX 组件");
  expect(sourceCardLabel(esm)).toContain("MDX 导入");

  const changedJsx = jsx.raw.replace("value={count + 1}", "value={count + 3}");
  expect(validateSourceCardEdit(article, jsx, changedJsx)).toEqual({
    source: changedJsx,
    reason: null,
  });
  expect(validateSourceCardEdit(article, jsx, "<Widget value={}>\n</Widget>").source).toBeNull();
  expect(validateSourceCardEdit(article, jsx, "<Widget />\n\n# Swallowed").source).toBeNull();
  expect(validateSourceCardEdit(article, jsx, " ").source).toBeNull();
  expect(validateSourceCardEdit(article, inlineJsx, '<Badge tone="cool" />').reason).toBeNull();
  expect(
    validateSourceCardEdit(article, inlineJsx, '<Badge tone="cool" />\n\n# Head').source,
  ).toBeNull();

  const changedEsm = esm.raw.replace("count = 2", "count = 3");
  expect(validateSourceCardEdit(article, esm, changedEsm)).toEqual({
    source: changedEsm,
    reason: null,
  });
});

it("keeps raw HTML local to its Markdown source island", () => {
  const source = '---\ntitle: HTML\n---\n\nBefore.\n\n<div data-x="1">raw</div>\n\nAfter.\n';
  const article = segmentArticleSource(source, "md");
  const html = article.segments.find((segment) => segment.syntax === "html")!;
  expect(sourceCardLabel(html)).toBe("HTML 原文");
  const edited = validateSourceCardEdit(article, html, '<div data-x="2">raw</div>');
  expect(edited.reason).toBeNull();
  expect(replaceArticleSegments(article, new Map([[html.id, edited.source!]]))).toBe(
    source.replace('data-x="1"', 'data-x="2"'),
  );
});
