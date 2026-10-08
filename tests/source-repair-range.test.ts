import { Schema } from "@milkdown/kit/prose/model";
import { EditorState } from "@milkdown/kit/prose/state";
import { expect, it } from "vitest";
import { mapSourceRepair, sourceRepairText } from "../src/client/articles/source-repair-range";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
    hardbreak: { inline: true, group: "inline" },
    image: { inline: true, group: "inline" },
  },
  marks: { strong: {} },
});
const doc = (nodes: Parameters<typeof schema.nodes.paragraph.create>[1]) =>
  schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, nodes));

it("tracks a damaged inline source through deletion of its break without absorbing neighbors", () => {
  const before = doc([
    schema.text("前文 `中"),
    schema.nodes.hardbreak.create(),
    schema.text("文` 后文"),
  ]);
  const range = { id: 1, from: 4, to: 9, kind: "inlineCode" as const };
  expect(sourceRepairText(before, range)).toBe("`中\n文`");
  const tr = EditorState.create({ doc: before }).tr.delete(6, 7);
  const mapped = mapSourceRepair(range, tr.mapping)!;
  expect(sourceRepairText(tr.doc, mapped)).toBe("`中文`");
  const outside = EditorState.create({ doc: tr.doc }).tr.insertText("之前", 1);
  expect(sourceRepairText(outside.doc, mapSourceRepair(mapped, outside.mapping)!)).toBe("`中文`");
});

it("reads heading source across breaks and preserves repeated and trailing breaks", () => {
  const before = doc([
    schema.text("## 标题"),
    schema.nodes.hardbreak.create(),
    schema.nodes.hardbreak.create(),
  ]);
  const range = { id: 2, from: 0, to: before.content.size, kind: "heading" as const };
  expect(sourceRepairText(before, range)).toBe("## 标题\n\n");
  const tr = EditorState.create({ doc: before }).tr.delete(6, 8);
  expect(sourceRepairText(tr.doc, mapSourceRepair(range, tr.mapping)!)).toBe("## 标题");
});

it("does not reinterpret formatted content or unsupported inline nodes", () => {
  for (const node of [
    schema.text("内容", [schema.marks.strong.create()]),
    schema.nodes.image.create(),
  ]) {
    const article = doc(node);
    expect(
      sourceRepairText(article, { id: 3, from: 1, to: 1 + node.nodeSize, kind: "strong" }),
    ).toBeNull();
  }
});

it("drops a range when its entire literal source is deleted", () => {
  const article = doc(schema.text("前`代码`后"));
  const tr = EditorState.create({ doc: article }).tr.delete(2, 6);
  expect(mapSourceRepair({ id: 4, from: 2, to: 6, kind: "inlineCode" }, tr.mapping)).toBeNull();
});

it("does not restore a heading while a paragraph break still separates its source", () => {
  const article = schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, schema.text("## 标题")),
    schema.nodes.paragraph.create(),
  ]);
  expect(
    sourceRepairText(article, { id: 5, from: 0, to: article.content.size, kind: "heading" }),
  ).toBeNull();
});
