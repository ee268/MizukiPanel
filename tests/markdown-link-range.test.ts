import { Schema } from "@milkdown/kit/prose/model";
import { expect, it } from "vitest";
import { markdownLinkAt } from "../src/client/articles/markdown-link-range";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
    image: { inline: true, group: "inline" },
  },
  marks: {
    link: { attrs: { href: {}, title: { default: null } } },
    strong: {},
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
    expect(markdownLinkAt(doc, cursor)).toEqual({ from: 4, to: 24, mark: link });
  }
  expect(markdownLinkAt(doc, 3)).toBeNull();
  expect(markdownLinkAt(doc, 24)).toBeNull();
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
  expect(markdownLinkAt(doc, 2)).toEqual({ from: 1, to: 4, mark: first });
  expect(markdownLinkAt(doc, 4)).toEqual({ from: 4, to: 7, mark: second });
  expect(markdownLinkAt(doc, 8)).toEqual({ from: 7, to: 12, mark: third });
  expect(markdownLinkAt(doc, 0)).toBeNull();
});
