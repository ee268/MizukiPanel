import { expect, it } from "vitest";
import { parseGithubAlert, updateGithubAlert } from "../src/lib/articles/github-alerts";
import { parseInlineExtension, updateInlineExtension } from "../src/lib/articles/inline-extensions";
import { collectSourceIslandEdits } from "../src/lib/articles/source-island-edits";
import { replaceArticleSegments, segmentArticleSource } from "../src/lib/articles/source-islands";
import { validateArticleBody } from "../src/lib/server/article-body-validation";

it("edits Wiki Link targets and labels while retaining the standalone card syntax", () => {
  const wiki = parseInlineExtension("[[guides/start#install|安装说明]]");
  expect(wiki).toEqual({
    kind: "wiki",
    raw: "[[guides/start#install|安装说明]]",
    target: "guides/start#install",
    label: "安装说明",
  });
  expect(updateInlineExtension(wiki!, { target: "guides/next#setup", label: "新标题" })).toBe(
    "[[guides/next#setup|新标题]]",
  );
  expect(updateInlineExtension(wiki!, { label: "" })).toBe("[[guides/start#install]]");
  expect(parseInlineExtension("[[#local-heading]]")?.kind).toBe("wiki");
  expect(updateInlineExtension(wiki!, { target: "../outside" })).toBeNull();
  expect(updateInlineExtension(wiki!, { target: "posts" })).toBeNull();
});

it("edits Spoiler content without accepting unsupported directives or embeds", () => {
  const spoiler = parseInlineExtension(":spoiler[**答案**]");
  expect(spoiler).toEqual({ kind: "spoiler", raw: ":spoiler[**答案**]", content: "**答案**" });
  expect(updateInlineExtension(spoiler!, { content: "新的答案" })).toBe(":spoiler[新的答案]");
  expect(updateInlineExtension(spoiler!, { content: "带 ] 的内容" })).toBeNull();
  expect(parseInlineExtension(":spoiler[答案]{class=red}")).toBeNull();
  expect(parseInlineExtension("![[image]]")).toBeNull();
});

it("edits GitHub alert fields and preserves untouched quote content and CRLF", () => {
  const raw = "> [!WARNING] 原标题\r\n> 第一行 **加粗**\r\n>\r\n> 第二段";
  const alert = parseGithubAlert(raw);
  expect(alert?.type).toBe("WARNING");
  expect(alert?.body).toBe("第一行 **加粗**\r\n\r\n第二段");
  const titled = updateGithubAlert(alert!, { title: "新标题" });
  expect(titled).toBe(raw.replace("原标题", "新标题"));
  const edited = updateGithubAlert(alert!, { type: "NOTE", body: "修改后\r\n\r\n下一段" });
  expect(edited).toBe("> [!NOTE] 原标题\r\n> 修改后\r\n>\r\n> 下一段");
  expect(updateGithubAlert(alert!, { body: "修改后\n下一段" })).toBe(
    "> [!WARNING] 原标题\r\n> 修改后\r\n> 下一段",
  );
  expect(updateGithubAlert(alert!, { body: "" })).toBeNull();
  expect(parseGithubAlert("> [!UNKNOWN]\n> text")).toBeNull();
  expect(parseGithubAlert("> [!NOTE]\nLazy continuation")).toBeNull();
});

it("saves only selected inline islands in a mixed Markdown article", async () => {
  const source = [
    "---\r\ntitle: Inline\r\n---\r\n",
    "\r\n查看 [[guide/old|旧链接]] 和 :spoiler[答案]。\r\n\r\n",
    "> [!NOTE]\r\n> 保留提示内容。\r\n\r\n",
    "![[unhandled-embed]] 和 [[other]]。\r\n",
  ].join("");
  const article = segmentArticleSource(source, "md");
  expect(article.mode).toBe("hybrid");
  const wiki = article.segments.find((segment) => segment.raw === "[[guide/old|旧链接]]");
  const spoiler = article.segments.find((segment) => segment.raw === ":spoiler[答案]");
  const alert = article.segments.find((segment) => segment.syntax === "githubAdmonition");
  expect(wiki && spoiler && alert).toBeTruthy();

  const updatedWiki = updateInlineExtension(parseInlineExtension(wiki!.raw)!, {
    target: "guide/new",
  });
  const updatedAlert = updateGithubAlert(parseGithubAlert(alert!.raw)!, { type: "TIP" });
  const changed = replaceArticleSegments(
    article,
    new Map([
      [wiki!.id, updatedWiki!],
      [alert!.id, updatedAlert!],
    ]),
  );
  expect(changed).toBe(source.replace(wiki!.raw, updatedWiki!).replace(alert!.raw, updatedAlert!));
  expect(changed).toContain(spoiler!.raw);
  expect(changed).toContain("![[unhandled-embed]]");
  expect(replaceArticleSegments(article, new Map())).toBe(source);
  const edits = collectSourceIslandEdits(source, changed, "md");
  expect(edits).toEqual([
    { id: wiki!.id, source: updatedWiki },
    { id: alert!.id, source: updatedAlert },
  ]);
  await expect(
    validateArticleBody(source, changed.slice(article.bodyStart), "md", edits),
  ).resolves.toBe(changed);
  await expect(
    validateArticleBody(source, changed.slice(article.bodyStart), "md", []),
  ).rejects.toThrow();
});

it("does not expose Wiki Link syntax inside an ordinary Markdown link", () => {
  const source = "---\ntitle: Link\n---\n\n[see [[guide]]](https://example.com) and [[guide]].\n";
  const article = segmentArticleSource(source, "md");
  expect(article.segments.filter((segment) => segment.syntax === "wikiLink")).toHaveLength(1);
  expect(replaceArticleSegments(article, new Map())).toBe(source);
});
