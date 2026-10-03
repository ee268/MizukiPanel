import { expect, it } from "vitest";
import { parseMdxComponent, updateMdxComponent } from "../src/lib/articles/mdx-components";
import { validateSourceCardEdit } from "../src/lib/articles/mdx-source-edit";
import { collectSourceIslandEdits } from "../src/lib/articles/source-island-edits";
import { replaceArticleSegments, segmentArticleSource } from "../src/lib/articles/source-islands";
import { validateArticleBody } from "../src/lib/server/article-body-validation";

it("edits static component props while preserving dynamic props, children, and line endings", async () => {
  const source = [
    "\uFEFF---\r\n",
    "title: Component\r\n",
    "---\r\n",
    "\r\n",
    "import Card from './Card.astro'\r\n",
    "\r\n",
    "Before.\r\n",
    "\r\n",
    "<Card title = \"First\" tone='warm' active count={count + 1} {...more}>\r\n",
    "\r\n",
    "**Nested Markdown**\r\n",
    "\r\n",
    "</Card>\r\n",
    "\r\n",
    "After.\r\n",
  ].join("");
  const article = segmentArticleSource(source, "mdx");
  const segment = article.segments.find((part) => part.syntax === "mdxJsxFlowElement")!;
  const component = parseMdxComponent(segment)!;
  expect(component.name).toBe("Card");
  expect(component.attributes.map((attribute) => [attribute.name, attribute.kind])).toEqual([
    ["title", "string"],
    ["tone", "string"],
    ["active", "boolean"],
  ]);
  expect(component.dynamicAttributes).toEqual(["count={count + 1}", "{...more}"]);

  const title = component.attributes.find((attribute) => attribute.name === "title")!;
  const active = component.attributes.find((attribute) => attribute.name === "active")!;
  const updated = updateMdxComponent(
    component,
    new Map<number, string | boolean>([
      [title.index, 'Second & "new"'],
      [active.index, false],
    ]),
  )!;
  expect(updated).toContain('title = "Second &amp; &quot;new&quot;"');
  expect(updated).toContain("tone='warm'");
  expect(updated).not.toContain(" active ");
  expect(updated).toContain("count={count + 1} {...more}");
  expect(updated).toContain("**Nested Markdown**\r\n");
  expect(validateSourceCardEdit(article, segment, updated).reason).toBeNull();

  const draft = replaceArticleSegments(article, new Map([[segment.id, updated]]));
  expect(draft.startsWith("\uFEFF---\r\ntitle: Component\r\n---\r\n")).toBe(true);
  expect(draft).toContain("Before.\r\n");
  expect(draft).toContain("After.\r\n");
  const edits = collectSourceIslandEdits(source, draft, "mdx");
  expect(edits).toEqual([{ id: segment.id, source: updated }]);
  await expect(
    validateArticleBody(source, draft.slice(article.bodyStart), "mdx", edits),
  ).resolves.toBe(draft);
});

it("handles inline components, quote style, and boolean attributes without changing siblings", () => {
  const source = "---\ntitle: Inline\n---\n\nA <Badge text='old' visible /> B <Other />.\n";
  const article = segmentArticleSource(source, "mdx");
  const badges = article.segments.filter((part) => part.syntax === "mdxJsxTextElement");
  const component = parseMdxComponent(badges[0])!;
  expect(component.name).toBe("Badge");
  const text = component.attributes.find((attribute) => attribute.name === "text")!;
  const visible = component.attributes.find((attribute) => attribute.name === "visible")!;
  const changed = updateMdxComponent(component, new Map([[text.index, "it's ready"]]))!;
  expect(changed).toBe("<Badge text='it&#39;s ready' visible />");
  const hidden = updateMdxComponent(component, new Map([[visible.index, false]]))!;
  expect(hidden).toBe("<Badge text='old'  />");
  expect(updateMdxComponent(component, new Map([[visible.index, true]]))).toBe(component.raw);
  expect(validateSourceCardEdit(article, badges[0], changed).reason).toBeNull();
  expect(replaceArticleSegments(article, new Map([[badges[0].id, changed]]))).toBe(
    source.replace(component.raw, changed),
  );
});

it("leaves lowercase HTML, fragments, and unsupported attribute syntax in source cards", () => {
  expect(parseMdxComponent({ syntax: "mdxJsxFlowElement", raw: '<div title="x" />' })).toBeNull();
  expect(parseMdxComponent({ syntax: "mdxJsxFlowElement", raw: "<>text</>" })).toBeNull();
  expect(
    updateMdxComponent(
      parseMdxComponent({ syntax: "mdxJsxFlowElement", raw: '<Card title="x" />' })!,
      new Map([[0, "multi\nline"]]),
    ),
  ).toBeNull();
});
