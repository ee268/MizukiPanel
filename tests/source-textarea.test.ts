import { describe, expect, it } from "vitest";
import {
  mergeTextareaChange,
  toSourceOffset,
  toSourceSelection,
  toTextareaSelection,
} from "../src/client/articles/source-textarea";

describe("source textarea line ending mapping", () => {
  const source = "---\r\ntitle: Demo\r\n---\r\nBody text\r\n";
  const visible = source.replaceAll("\r\n", "\n");

  it("maps visible selections to original CRLF offsets and back", () => {
    const start = visible.indexOf("Body");
    const selection = { start, end: start + 4 };
    expect(toSourceOffset(source, start)).toBe(source.indexOf("Body"));
    expect(toTextareaSelection(source, toSourceSelection(source, selection))).toEqual(selection);
  });

  it("changes only typed text and keeps untouched line endings", () => {
    expect(mergeTextareaChange(source, visible.replace("Body", "New body"))).toBe(
      "---\r\ntitle: Demo\r\n---\r\nNew body text\r\n",
    );
    expect(mergeTextareaChange(source, visible.replace("Body", "First\nSecond"))).toBe(
      "---\r\ntitle: Demo\r\n---\r\nFirst\r\nSecond text\r\n",
    );
  });
});
