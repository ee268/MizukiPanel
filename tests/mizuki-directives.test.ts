import { expect, it } from "vitest";
import { parseMizukiDirective, updateMizukiDirective } from "../src/lib/articles/mizuki-directives";
import { replaceArticleSegments, segmentArticleSource } from "../src/lib/articles/source-islands";

it("edits a callout title and body without touching adjacent article bytes", () => {
  const source = [
    "---\r\ntitle: Directives\r\n---\r\n",
    "\r\nBefore.\r\n\r\n",
    ":::note[旧标题]\r\n**正文**与链接。\r\n:::",
    "\r\n\r\nAfter.\r\n",
  ].join("");
  const article = segmentArticleSource(source, "md");
  const segment = article.segments.find((part) => part.syntax === "containerDirective");
  expect(segment).toBeDefined();
  const directive = parseMizukiDirective(segment!.raw);
  expect(directive?.kind).toBe("admonition");
  expect(directive?.title).toBe("旧标题");
  const changed = updateMizukiDirective(directive!, {
    title: '新的 "标题"',
    body: "新的 **正文**。",
  });
  expect(changed).toContain('title="新的 &quot;标题&quot;"');
  expect(parseMizukiDirective(changed!)?.body).toBe("新的 **正文**。");
  expect(replaceArticleSegments(article, new Map([[segment!.id, changed!]]))).toBe(
    source.replace(segment!.raw, changed!),
  );
  expect(replaceArticleSegments(article, new Map())).toBe(source);
});

it("edits leaf and empty container GitHub cards in their original marker form", () => {
  for (const marker of ["::", ":::"]) {
    const raw = `${marker}github{repo="old/repo"}`;
    const directive = parseMizukiDirective(raw);
    expect(directive?.kind).toBe("github");
    const changed = updateMizukiDirective(directive!, { repo: "new/repository" });
    expect(changed).toBe(`${marker}github{repo="new/repository"}`);
    expect(updateMizukiDirective(directive!, { repo: "not a repo" })).toBeNull();
  }
});

it("edits image grid settings and Markdown child content", () => {
  const raw = [
    ':::grid{columns="3" aspect="16/9" fit="cover"}',
    "![第一张](./one.webp)",
    "",
    "![第二张](./two.webp)",
    ":::",
  ].join("\n");
  const directive = parseMizukiDirective(raw);
  expect(directive?.kind).toBe("grid");
  expect(directive?.images).toHaveLength(2);
  const changed = updateMizukiDirective(directive!, {
    columns: "2",
    body: "![替换](./new.webp)",
  });
  expect(changed).toContain('columns="2"');
  expect(parseMizukiDirective(changed!)?.images).toEqual([
    { url: "./new.webp", alt: "替换", title: null },
  ]);
  expect(updateMizukiDirective(directive!, { body: "没有图片" })).toBeNull();
});

it("leaves unknown directives and attributes as protected source", () => {
  expect(parseMizukiDirective(":::custom\nDo not touch.\n::: ")).toBeNull();
  expect(parseMizukiDirective(':::note{title="Safe" color="red"}\nText\n:::')).toBeNull();
  expect(parseMizukiDirective(':::grid{columns="3" data-x="1"}\n![x](x.png)\n:::')).toBeNull();
  expect(parseMizukiDirective(":::note\nMissing closing fence")).toBeNull();
});
