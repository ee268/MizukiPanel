import { expect, it } from "vitest";
import { replaceFrontmatterYaml } from "../src/client/articles/frontmatter-repair";
import { splitArticleSource } from "../src/lib/articles/article-source";

it("repairs invalid YAML without changing the body, BOM or CRLF boundaries", () => {
  const source = '\uFEFF--- \r\ntitle: [broken\r\n--- \r\n\r\n正文\r\n<img src="a.png" />\r\n';
  const repaired = replaceFrontmatterYaml(source, "title: 修复\n# comment\n");
  expect(repaired).toBe(
    '\uFEFF--- \r\ntitle: 修复\r\n# comment\r\n\r\n--- \r\n\r\n正文\r\n<img src="a.png" />\r\n',
  );
  expect(splitArticleSource(repaired)?.body).toBe(splitArticleSource(source)?.body);
});

it("adds missing metadata without dropping any existing content", () => {
  expect(replaceFrontmatterYaml("\uFEFF# 原文\n正文\n", "title: 新标题")).toBe(
    "\uFEFF---\ntitle: 新标题\n---\n# 原文\n正文\n",
  );
});

it("preserves inserted blank lines and allows undoing a YAML edit", () => {
  const source = "---\ntitle: [broken\n---\n正文\n";
  const edited = replaceFrontmatterYaml(source, "title:\n\n  修复");
  expect(splitArticleSource(edited)?.yaml).toBe("title:\n\n  修复\n");
  expect(replaceFrontmatterYaml(edited, "title: [broken")).toBe(source);
});
