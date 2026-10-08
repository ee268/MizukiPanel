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
    expect(articleShortcut(keyEvent("b", { ctrlKey: true }))).toBeNull();
    expect(articleShortcut(keyEvent("I", { metaKey: true }))).toBeNull();
    expect(articleShortcut(keyEvent("k", { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(articleShortcut(keyEvent("k", { ctrlKey: true }))).toBeNull();
    expect(articleShortcut(keyEvent("s", { metaKey: true }))).toBe("save");
    expect(articleShortcut(keyEvent("s"))).toBeNull();
  });

  it("ignores composition and unrelated modified keys", () => {
    expect(articleShortcut(keyEvent("s", { ctrlKey: true, composing: true }))).toBeNull();
    expect(articleShortcut(keyEvent("s", { ctrlKey: true, keyCode: 229 }))).toBeNull();
    expect(articleShortcut(keyEvent("s", { ctrlKey: true, altKey: true }))).toBeNull();
    expect(articleShortcut(keyEvent("s", { ctrlKey: true, shiftKey: true }))).toBeNull();
  });
});
