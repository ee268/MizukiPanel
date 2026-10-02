import katex from "katex";
import { expect, it } from "vitest";
import { parseCodeGroup, updateCodeGroup } from "../src/lib/articles/code-groups";
import { parseFencedCode, updateFencedCode } from "../src/lib/articles/fenced-code";
import { parseMathFragment, updateMathFragment } from "../src/lib/articles/math-fragments";
import { collectSourceIslandEdits } from "../src/lib/articles/source-island-edits";
import { replaceArticleSegments, segmentArticleSource } from "../src/lib/articles/source-islands";
import { validateArticleBody } from "../src/lib/server/article-body-validation";

it("edits inline and display math without changing their delimiters", () => {
  const inline = parseMathFragment("$x+y$");
  const display = parseMathFragment("$$\r\nx^2\r\n$$");
  expect(inline?.value).toBe("x+y");
  expect(display?.value).toBe("x^2");
  expect(updateMathFragment(inline!, "a+b")).toBe("$a+b$");
  expect(updateMathFragment(display!, "a^2+b^2")).toBe("$$\r\na^2+b^2\r\n$$");
  expect(updateMathFragment(inline!, "a\nb")).toBeNull();
  expect(updateMathFragment(display!, "")).toBeNull();
  expect(katex.renderToString("a^2+b^2", { throwOnError: false })).toContain("katex");
});

it("edits diagram and Expressive Code fences while preserving body and metadata", () => {
  const mermaid = parseFencedCode("~~~mermaid\ngraph LR\nA-->B\n~~~");
  const expressive = parseFencedCode("```js title=demo.js showLineNumbers\nconst x = 1;\n```");
  expect(mermaid?.lang).toBe("mermaid");
  expect(updateFencedCode(mermaid!, { body: "graph LR\nA-->C" })).toBe(
    "~~~mermaid\ngraph LR\nA-->C\n~~~",
  );
  expect(expressive?.meta).toBe("title=demo.js showLineNumbers");
  expect(updateFencedCode(expressive!, { meta: "title=next.js showLineNumbers" })).toBe(
    "```js title=next.js showLineNumbers\nconst x = 1;\n```",
  );
  expect(updateFencedCode(expressive!, { body: "```" })).toBeNull();

  const source = "---\ntitle: Rich\n---\n\nText $x+y$.\n\n$$\nx^2\n$$\n\n~~~mermaid\ngraph LR\nA-->B\n~~~\n\n```js title=demo.js\nconst x = 1;\n```\n";
  const segments = segmentArticleSource(source, "md").segments.filter((part) => part.mode === "source");
  expect(segments.map((part) => part.syntax)).toEqual([
    "inlineMath",
    "math",
    "code:mermaid",
    "code:js",
  ]);
  expect(segments[2].raw).toBe(mermaid!.raw);
});

it("protects complete code groups and edits labels or one tab without rewriting another", async () => {
  const groupRaw = [
    "::: code-group labels=[npm, pnpm]",
    "",
    "```bash",
    "npm install",
    "```",
    "",
    "```bash",
    "pnpm install",
    "```",
    "",
    ":::",
  ].join("\n");
  const group = parseCodeGroup(groupRaw);
  expect(group?.labels).toEqual(["npm", "pnpm"]);
  expect(group?.blocks).toHaveLength(2);
  const changed = updateCodeGroup(group!, {
    labels: ["npm", "pnpm 10"],
    blocks: [
      { meta: "", body: "npm ci" },
      { meta: "", body: "pnpm install" },
    ],
  });
  expect(changed).toContain("npm ci");
  expect(changed).toContain("pnpm install");
  expect(parseCodeGroup(changed!)?.labels).toEqual(["npm", "pnpm 10"]);
  const bodyOnly = updateCodeGroup(group!, {
    labels: group!.labels,
    blocks: [
      { meta: "", body: "npm ci" },
      { meta: "", body: "pnpm install" },
    ],
  });
  expect(bodyOnly).toBe(groupRaw.replace("npm install", "npm ci"));

  const source = "---\ntitle: Group\n---\n\nBefore.\n\n" + groupRaw + "\n\nAfter.\n";
  const article = segmentArticleSource(source, "md");
  const segment = article.segments.find((part) => part.syntax === "codeGroup");
  expect(article.mode).toBe("hybrid");
  expect(segment?.raw).toBe(groupRaw);
  const draft = replaceArticleSegments(article, new Map([[segment!.id, changed!]]));
  expect(draft).toBe(source.replace(groupRaw, changed!));
  const edits = collectSourceIslandEdits(source, draft, "md");
  await expect(
    validateArticleBody(source, draft.slice(article.bodyStart), "md", edits),
  ).resolves.toBe(draft);
});

it("falls back for incomplete code groups and preserves unknown raw content", () => {
  const missingEnd = "---\ntitle: Group\n---\n\n::: code-group labels=[one]\n\n```js\nx\n```\n";
  expect(segmentArticleSource(missingEnd, "md").mode).toBe("source");
  expect(parseCodeGroup("::: code-group labels=[one]\nHello\n:::")).toBeNull();
});
