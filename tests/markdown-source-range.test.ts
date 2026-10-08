import { Schema } from "@milkdown/kit/prose/model";
import { Transform } from "@milkdown/kit/prose/transform";
import { expect, it } from "vitest";
import {
  markdownMarkAt,
  markdownSourceAt,
  mapUnchangedSource,
  sourceContentBounds,
  sourceCursorOffset,
} from "../src/client/articles/markdown-source-range";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    heading: {
      content: "inline*",
      group: "block",
      attrs: { level: { default: 1 }, id: { default: "" } },
    },
    blockquote: { content: "block+", group: "block" },
    code_block: { content: "text*", group: "block", marks: "", code: true },
    text: { group: "inline" },
    image: { inline: true, group: "inline" },
  },
  marks: {
    link: { attrs: { href: {}, title: { default: null } } },
    strong: {},
    emphasis: {},
    strike_through: {},
    inlineCode: { code: true },
  },
});

it("finds the whole link across text formatting and inline images", () => {
  const link = schema.marks.link.create({ href: "docs/REACT_MUI_MIGRATION.md", title: "说明" });
  const doc = schema.nodes.doc.create(
    null,
    schema.nodes.paragraph.create(null, [
      schema.text("前文 "),
      schema.text("React ", [link]),
      schema.text("Material UI", [link, schema.marks.strong.create()]),
      schema.nodes.image.create(null, null, [link]),
      schema.text("迁移", [link]),
      schema.text(" 后文"),
    ]),
  );
  for (const cursor of [4, 9, 19, 21, 22]) {
    expect(markdownMarkAt(doc, cursor, "link")).toEqual({ from: 4, to: 24, mark: link });
  }
  expect(markdownMarkAt(doc, 3, "link")).toBeNull();
  expect(markdownMarkAt(doc, 24, "link")).toBeNull();
});

it("keeps adjacent links with different destinations or titles separate", () => {
  const first = schema.marks.link.create({ href: "/one" });
  const second = schema.marks.link.create({ href: "/two" });
  const third = schema.marks.link.create({ href: "/two", title: "another" });
  const doc = schema.nodes.doc.create(
    null,
    schema.nodes.paragraph.create(null, [
      schema.text("One", [first]),
      schema.text("Two", [second]),
      schema.text("Three", [third]),
    ]),
  );
  expect(markdownMarkAt(doc, 2, "link")).toEqual({ from: 1, to: 4, mark: first });
  expect(markdownMarkAt(doc, 4, "link")).toEqual({ from: 4, to: 7, mark: second });
  expect(markdownMarkAt(doc, 8, "link")).toEqual({ from: 7, to: 12, mark: third });
  expect(markdownMarkAt(doc, 0, "link")).toBeNull();
});

it.each(["strong", "emphasis", "strike_through", "inlineCode"])(
  "finds %s without including adjacent plain text",
  (kind) => {
    const doc = schema.nodes.doc.create(
      null,
      schema.nodes.paragraph.create(null, [
        schema.text("Before "),
        schema.text("formatted", [schema.marks[kind].create()]),
        schema.text(" after"),
      ]),
    );
    expect(markdownSourceAt(doc, 12)).toEqual({ kind, from: 8, to: 17 });
    expect(markdownSourceAt(doc, 7)).toBeNull();
    expect(markdownSourceAt(doc, 17)).toBeNull();
  },
);

it("expands an outer formatted span when the caret enters nested emphasis", () => {
  const strong = schema.marks.strong.create();
  const doc = schema.nodes.doc.create(
    null,
    schema.nodes.paragraph.create(null, [
      schema.text("one ", [strong]),
      schema.text("two", [strong, schema.marks.emphasis.create()]),
      schema.text(" three", [strong]),
    ]),
  );
  expect(markdownSourceAt(doc, 6)).toEqual({ kind: "strong", from: 1, to: 14 });
});

it.each([1, 2, 3, 4, 5, 6])("finds a level %s heading inside a blockquote", (level) => {
  const heading = schema.nodes.heading.create({ level }, schema.text("Title"));
  const doc = schema.nodes.doc.create(null, schema.nodes.blockquote.create(null, heading));
  const range = markdownSourceAt(doc, 4)!;
  expect(range).toEqual({ kind: "heading", from: 1, to: 8 });
  expect(sourceContentBounds(range)).toEqual({ from: 2, to: 7 });
});

it("opens an empty heading but leaves ordinary paragraphs and fenced code alone", () => {
  const doc = schema.nodes.doc.create(null, [
    schema.nodes.heading.create({ level: 2 }),
    schema.nodes.paragraph.create(null, schema.text("Plain")),
    schema.nodes.code_block.create(null, schema.text("**literal**")),
  ]);
  expect(markdownSourceAt(doc, 1)).toEqual({ kind: "heading", from: 0, to: 2 });
  expect(markdownSourceAt(doc, 4)).toBeNull();
  expect(markdownSourceAt(doc, 11)).toBeNull();
});

it("places the initial caret after the Markdown opening delimiters", () => {
  for (const [raw, offset, expected] of [
    ["**bold**", 2, 4],
    ["*italic*", 2, 3],
    ["~~deleted~~", 3, 5],
    ["`code`", 2, 3],
    ["***nested***", 2, 5],
    ["###### Heading", 3, 10],
    ["[label](url)", 2, 3],
  ] as const) {
    expect(sourceCursorOffset(raw, offset)).toBe(expected);
  }
});

it("keeps a source field open for node attribute maintenance, but not changed content", () => {
  const heading = schema.nodes.heading.create({ level: 2 }, schema.text("Title"));
  const doc = schema.nodes.doc.create(null, heading);
  const range = markdownSourceAt(doc, 3)!;
  const attributes = new Transform(doc).setNodeMarkup(0, undefined, { level: 2, id: "title" });
  expect(mapUnchangedSource(range, doc, attributes.doc, attributes.mapping)).toEqual(range);
  const levelChange = new Transform(doc).setNodeMarkup(0, undefined, { level: 3 });
  expect(mapUnchangedSource(range, doc, levelChange.doc, levelChange.mapping)).toBeNull();
  const changed = new Transform(doc).insert(3, schema.text("new"));
  expect(mapUnchangedSource(range, doc, changed.doc, changed.mapping)).toBeNull();
});
