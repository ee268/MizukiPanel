import { expect, it } from "vitest";
import {
  defaultPersonalSettings,
  emptyDocument,
  parseSettings,
  patchSettings,
} from "../src/shared/panel-settings";
import {
  defaultEditorMode,
  editorBodyFont,
  editorCodeSize,
} from "../src/client/articles/editor-preferences";
import {
  readPersonalSettings,
  savePersonalSettings,
  personalSettingsKey,
} from "../src/client/settings/personal-storage";

it("keeps format-aware defaults and respects every explicit mode", () => {
  expect(defaultEditorMode("md", "auto")).toBe("ir");
  expect(defaultEditorMode("mdx", "auto")).toBe("sv");
  expect(defaultEditorMode("mdx", "auto", "ir")).toBe("ir");
  expect(defaultEditorMode("mdx", "wysiwyg", "ir")).toBe("wysiwyg");
  for (const mode of ["ir", "wysiwyg", "sv"] as const) {
    expect(defaultEditorMode("md", mode)).toBe(mode);
    expect(defaultEditorMode("mdx", mode)).toBe(mode);
  }
});
it("honors explicit body fonts while preserving the global system-font choice for project defaults", () => {
  expect(editorBodyFont("project", "panel", "custom")).toBe("custom");
  expect(editorBodyFont("project", "panel", "system")).toBe("system");
  expect(editorBodyFont("project", "system", "custom")).toBe("system");
  expect(editorBodyFont("panel", "system", "custom")).toBe("panel");
  expect(editorBodyFont("system", "panel", "custom")).toBe("system");
  expect(editorCodeSize(defaultPersonalSettings.editor)).toBe("13.6px");
  expect(editorCodeSize({ ...defaultPersonalSettings.editor, bodyFontSize: 20 })).toBe("17px");
  expect(
    editorCodeSize({ ...defaultPersonalSettings.editor, bodyFontSize: 20, codeFontSize: 14 }),
  ).toBe("14px");
});
it("adds defaults to stage-one profiles without writing or losing existing data", () => {
  const raw = JSON.stringify({
    schemaVersion: 1,
    revision: "existing",
    values: { appearance: { hue: 170 }, custom: { future: true } },
  });
  let saved = raw;
  const storage = {
    getItem: (key: string) => (key === personalSettingsKey ? saved : null),
    setItem: (_key: string, value: string) => {
      saved = value;
    },
    removeItem: () => {},
  };
  const snapshot = readPersonalSettings(storage);
  expect(snapshot.document.values.editor).toEqual(defaultPersonalSettings.editor);
  expect(saved).toBe(raw);
  const base = snapshot.document.values.editor;
  savePersonalSettings(storage, {
    editor: { fields: { bodyLineHeight: 2.1, outline: true, tabWidth: 8 }, base },
  });
  expect(readPersonalSettings(storage).document.values.appearance.hue).toBe(170);
  expect(readPersonalSettings(storage).document.values.custom).toEqual({ future: true });
  expect(() =>
    savePersonalSettings(storage, { editor: { fields: { bodyFontSize: 20 }, base } }),
  ).toThrow("其他位置修改");
});
it("validates editor boundaries and uses field-level fallbacks for corrupt values", () => {
  for (const [key, value] of Object.entries({
    defaultMode: "raw",
    outline: "true",
    outlineWidth: 421,
    bodyFont: "url",
    bodyFontSize: 11,
    bodyLineHeight: Infinity,
    codeFont: "url",
    codeFontSize: 25,
    tabWidth: 3,
    spellcheck: 1,
  })) {
    expect(() =>
      patchSettings(emptyDocument("browser"), "browser", "editor", { [key]: value }, "test"),
    ).toThrow("无效");
  }
  const result = parseSettings(
    JSON.stringify({
      schemaVersion: 1,
      values: { editor: { bodyFontSize: 24, bodyLineHeight: 2.4, tabWidth: 1, future: "keep" } },
    }),
    "browser",
  );
  expect(result.document.values.editor).toMatchObject({
    bodyFontSize: 24,
    bodyLineHeight: 2.4,
    tabWidth: 4,
    future: "keep",
  });
  expect(result.warnings).toHaveLength(1);
});
