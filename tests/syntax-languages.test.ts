import { expect, it } from "vitest";
import { syntaxLanguages } from "../src/client/components/syntax-languages";

it("uses JSON tokens for feature data without interpreting values as JavaScript", () => {
  const source = '{"name":"友链","enabled":true,"count":12,"empty":null}';
  const tree = syntaxLanguages.json.language.parser.parse(source);
  expect(tree.resolveInner(source.indexOf("name") + 1).name).toBe("PropertyName");
  expect(tree.resolveInner(source.indexOf("友链") + 1).name).toBe("String");
  expect(tree.resolveInner(source.indexOf("true") + 1).name).toBe("True");
  expect(tree.resolveInner(source.indexOf("12") + 1).name).toBe("Number");
  expect(tree.resolveInner(source.indexOf("null") + 1).name).toBe("Null");
});

it("highlights YAML frontmatter, Markdown and fenced JSON or TypeScript in the same season source", () => {
  const source = [
    "---",
    "title: 新番季度",
    "comments: true",
    "---",
    "",
    "## 季度",
    "",
    "**加粗** 和 [链接](https://example.com)",
    "",
    "```json",
    '{"count":12}',
    "```",
    "",
    "```typescript",
    "const count: number = 12;",
    "```",
    "",
    "{% 123456 %}",
  ].join("\n");
  const tree = syntaxLanguages.markdown.language.parser.parse(source);
  expect(tree.toString()).toContain("Frontmatter");
  expect(tree.toString()).toContain("BlockMapping");
  expect(tree.toString()).toContain("ATXHeading2");
  expect(tree.toString()).toContain("StrongEmphasis");
  expect(tree.toString()).toContain("URL");
  expect(tree.resolveInner(source.indexOf('"count"') + 2).name).toBe("PropertyName");
  expect(tree.resolveInner(source.indexOf("const") + 1).name).toBe("const");
  expect(tree.resolveInner(source.indexOf("number") + 1).name).toBe("TypeName");
});
