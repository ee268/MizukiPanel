import { describe, expect, it } from "vitest";
import {
  applySourceFormat,
  insertSourceImage,
  insertSourceLink,
  insertSourceTable,
  setSourceHeading,
  toggleSourceLine,
} from "../src/client/articles/source-format";

describe("source editor formatting", () => {
  it("formats selected body text without changing Frontmatter", () => {
    const source = "---\ntitle: Demo\n---\n\nFirst paragraph";
    const start = source.indexOf("First");
    const bold = applySourceFormat(source, { start, end: start + 5 }, "bold");
    expect(bold.source).toBe("---\ntitle: Demo\n---\n\n**First** paragraph");
    expect(applySourceFormat(bold.source, bold, "bold").source).toBe(source);
    expect(applySourceFormat(source, { start, end: start + 5 }, "italic").source).toBe(
      "---\ntitle: Demo\n---\n\n*First* paragraph",
    );

    const heading = setSourceHeading(source, { start, end: start }, 2);
    expect(heading.source).toBe("---\ntitle: Demo\n---\n\n## First paragraph");
    expect(setSourceHeading(heading.source, heading, 0).source).toBe(source);
  });

  it("converts lines between lists and tasks while preserving CRLF", () => {
    const source = "One\r\nTwo\r\n";
    const selection = { start: 0, end: source.length - 2 };
    const ordered = toggleSourceLine(source, selection, "ordered");
    expect(ordered.source).toBe("1. One\r\n2. Two\r\n");
    const tasks = toggleSourceLine(ordered.source, ordered, "task");
    expect(tasks.source).toBe("- [ ] One\r\n- [ ] Two\r\n");
    expect(toggleSourceLine(tasks.source, tasks, "task").source).toBe(source);
    expect(toggleSourceLine(source, selection, "bullet").source).toBe("- One\r\n- Two\r\n");
  });

  it("inserts a code fence, table, link and image as editable Markdown", () => {
    expect(toggleSourceLine("Text", { start: 0, end: 0 }, "quote").source).toBe("> Text");
    expect(applySourceFormat("code", { start: 0, end: 4 }, "code").source).toBe("```\ncode\n```");
    expect(insertSourceTable("Before\nAfter", { start: 7, end: 7 }).source).toContain(
      "| 列 1 | 列 2 |\n| --- | --- |",
    );
    expect(insertSourceLink("Go", { start: 0, end: 2 }, "Go", "https://example.com").source).toBe(
      "[Go](https://example.com)",
    );
    expect(insertSourceImage("Text", { start: 4, end: 4 }, "cover", "/images/a.png").source).toBe(
      "Text![cover](/images/a.png)",
    );
  });
});
