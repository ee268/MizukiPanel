import type { KeyboardEvent } from "react";
import { describe, expect, it } from "vitest";
import { articleShortcut } from "../src/client/articles/editor-shortcuts";

function keyEvent(
  key: string,
  options: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    composing?: boolean;
    keyCode?: number;
  } = {},
): KeyboardEvent {
  return {
    key,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
    keyCode: options.keyCode ?? 0,
    nativeEvent: { isComposing: options.composing ?? false },
  } as KeyboardEvent;
}

describe("article editor shortcuts", () => {
  it("uses Ctrl or Command only while the editor has focus", () => {
    expect(articleShortcut(keyEvent("b", { ctrlKey: true }))).toBe("bold");
    expect(articleShortcut(keyEvent("I", { metaKey: true }))).toBe("italic");
    expect(articleShortcut(keyEvent("k", { ctrlKey: true, shiftKey: true }))).toBe("code");
    expect(articleShortcut(keyEvent("k", { ctrlKey: true }))).toBe("link");
    expect(articleShortcut(keyEvent("s", { metaKey: true }))).toBe("save");
    expect(articleShortcut(keyEvent("s"))).toBeNull();
  });

  it("ignores composition and unrelated modified keys", () => {
    expect(articleShortcut(keyEvent("b", { ctrlKey: true, composing: true }))).toBeNull();
    expect(articleShortcut(keyEvent("b", { ctrlKey: true, keyCode: 229 }))).toBeNull();
    expect(articleShortcut(keyEvent("b", { ctrlKey: true, altKey: true }))).toBeNull();
    expect(articleShortcut(keyEvent("b", { ctrlKey: true, shiftKey: true }))).toBeNull();
  });
});
