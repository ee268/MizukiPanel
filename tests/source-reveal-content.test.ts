import { Schema } from "@milkdown/kit/prose/model";
import { expect, it } from "vitest";
import { sourceRevealContent } from "../src/client/articles/source-reveal-content";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    heading: { content: "inline*", group: "block", attrs: { level: { default: 1 } } },
    text: { group: "inline" },
    hardbreak: { inline: true, group: "inline", selectable: false },
  },
  marks: {
    strong: {},
    emphasis: {},
    strike_through: {},
    inlineCode: {},
    link: { attrs: { href: { default: "/" } } },
  },
});
const paragraph = (...nodes: ReturnType<typeof schema.text>[]) =>
  schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, nodes));

it("rejects a partial italic parse of a broken bold delimiter", () => {
  const raw = "**加粗文字*";
  const parsed = paragraph(
    schema.text("*"),
    schema.text("加粗文字", [schema.marks.emphasis.create()]),
  );
  const result = sourceRevealContent(raw, "strong", () => parsed, schema);
  expect(result.presentation).toBe("plain");
  expect(result.content.toJSON()).toEqual([{ type: "text", text: raw }]);
});

it.each(["strong", "emphasis", "strike_through", "inlineCode", "link"] as const)(
  "restores complete %s syntax and accepts a deliberate change of format",
  (kind) => {
    const parsed = paragraph(schema.text("内容", [schema.marks[kind].create()]));
    const result = sourceRevealContent("complete source", "strong", () => parsed, schema);
    expect(result.presentation).toBe(kind);
    expect(result.content).toBe(parsed.firstChild!.content);
  },
);

it("keeps a whole nested span editable but renders a partial span as ordinary text", () => {
  const strong = schema.marks.strong.create();
  const nested = paragraph(
    schema.text("外层 ", [strong]),
    schema.text("内层", [strong, schema.marks.emphasis.create()]),
  );
  expect(sourceRevealContent("**外层 *内层***", "strong", () => nested, schema).presentation).toBe(
    "strong",
  );
  const partial = paragraph(schema.text("前缀"), schema.text("内容", [strong]));
  expect(sourceRevealContent("前缀**内容**", "strong", () => partial, schema).presentation).toBe(
    "plain",
  );
});

it("turns a broken heading into a paragraph and can restore its level", () => {
  const broken = sourceRevealContent(
    "###标题",
    "heading",
    () => paragraph(schema.text("###标题")),
    schema,
  );
  expect(broken.presentation).toBe("plain");
  expect(broken.content.toJSON()).toEqual({
    type: "paragraph",
    content: [{ type: "text", text: "###标题" }],
  });
  const heading = schema.nodes.heading.create({ level: 3 }, schema.text("标题"));
  const valid = sourceRevealContent(
    "### 标题",
    "heading",
    () => schema.nodes.doc.create(null, heading),
    schema,
  );
  expect(valid.presentation).toBe("heading");
  expect(valid.content).toBe(heading);
});

it("preserves empty or unparseable input without stale marks", () => {
  const failure = sourceRevealContent(
    "[未完成](",
    "link",
    () => {
      throw new Error("parse error");
    },
    schema,
  );
  expect(failure.presentation).toBe("plain");
  expect(failure.content.toJSON()).toEqual([{ type: "text", text: "[未完成](" }]);
  const empty = sourceRevealContent("", "inlineCode", () => null, schema);
  expect(empty.presentation).toBe("plain");
  expect(empty.content.toJSON()).toBeNull();
});

it.each(["strong", "emphasis", "strike_through", "inlineCode", "link", "heading"] as const)(
  "invalidates %s source on a newline and preserves literal characters and breaks",
  (kind) => {
    const parsed = paragraph(schema.text("normalized", [schema.marks.inlineCode.create()]));
    const result = sourceRevealContent("`中文\n代码`", kind, () => parsed, schema);
    expect(result.presentation).toBe("plain");
    const expected = [
      { type: "text", text: "`中文" },
      { type: "hardbreak" },
      { type: "text", text: "代码`" },
    ];
    expect(result.content.toJSON()).toEqual(
      kind === "heading" ? { type: "paragraph", content: expected } : expected,
    );
  },
);

it("preserves leading, repeated and trailing line breaks as ordinary inline breaks", () => {
  const result = sourceRevealContent("\n\n文字\r\n", "strong", () => null, schema);
  expect(result.content.toJSON()).toEqual([
    { type: "hardbreak" },
    { type: "hardbreak" },
    { type: "text", text: "文字" },
    { type: "hardbreak" },
  ]);
});
