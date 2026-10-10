import { expect, it } from "vitest";
import { defaultValues, emptyDocument } from "../src/shared/panel-settings";
import {
  exportPreferenceGroups,
  parsePreferenceBundle,
  preferenceDiff,
} from "../src/shared/preferences-transfer";
import {
  personalSettingsKey,
  readPersonalSettings,
  savePersonalSettings,
} from "../src/client/settings/personal-storage";
it("exports only schema preferences, excluding credentials, unknown fields and project association", () => {
  const machine = defaultValues("machine");
  machine.workspace.defaultProject = "a".repeat(64);
  machine.workspace.startup = "default";
  machine.workspace.token = "secret";
  machine.credentials = { cookie: "secret" };
  const groups = exportPreferenceGroups("machine", machine);
  expect(groups.workspace).not.toHaveProperty("defaultProject");
  expect(groups.workspace.startup).toBe("none");
  expect(JSON.stringify(groups)).not.toContain("secret");
  expect(
    parsePreferenceBundle(
      JSON.stringify({
        format: "mizuki-panel-preferences",
        schemaVersion: 1,
        scopes: { machine: groups },
      }),
    ).scopes.machine,
  ).toEqual(groups);
});
it("strictly rejects unknown or invalid imported fields, associations, oversized files and future versions", () => {
  const bundle = (scopes: unknown, schemaVersion = 1) =>
    JSON.stringify({ format: "mizuki-panel-preferences", schemaVersion, scopes });
  for (const scopes of [
    { browser: { appearance: { hue: 999 } } },
    { browser: { unknown: { a: 1 } } },
    { machine: { workspace: { defaultProject: "a".repeat(64) } } },
    { tokens: { a: 1 } },
    { project: { media: { folder: "../outside" } } },
  ])
    expect(() => parsePreferenceBundle(bundle(scopes))).toThrow();
  expect(() =>
    parsePreferenceBundle(bundle({ browser: { appearance: { mode: "dark" } } }, 2)),
  ).toThrow("版本");
  expect(() => parsePreferenceBundle(" ".repeat(1024 * 1024 + 1))).toThrow("1 MiB");
});
it("shows only changed fields and imports browser groups atomically with a recovery copy", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  data.set(personalSettingsKey, JSON.stringify(emptyDocument("browser")));
  data.set("unrelated-draft", "draft contents");
  const original = data.get(personalSettingsKey);
  const snapshot = readPersonalSettings(storage);
  const groups = { appearance: { mode: "dark", hue: 240 } };
  expect(preferenceDiff(snapshot.document.values, groups)).toEqual([
    { group: "appearance", field: "mode", before: "system", after: "dark" },
  ]);
  savePersonalSettings(
    storage,
    {
      appearance: { fields: { mode: "dark" }, base: snapshot.document.values.appearance },
      logs: { fields: { fontSize: 18 }, base: snapshot.document.values.logs },
    },
    true,
  );
  expect([...data.entries()].filter(([key]) => key.includes(":recovery:"))[0][1]).toBe(original);
  expect(data.get("unrelated-draft")).toBe("draft contents");
  const now = data.get(personalSettingsKey);
  expect(() =>
    savePersonalSettings(
      storage,
      { appearance: { fields: { hue: 300 }, base: snapshot.document.values.appearance } },
      true,
    ),
  ).toThrow("其他位置修改");
  expect(data.get(personalSettingsKey)).toBe(now);
});
it("stops before browser mutation when backup storage fails", () => {
  const raw = JSON.stringify(emptyDocument("browser"));
  let wrote = false;
  const storage = {
    getItem: () => raw,
    setItem: (key: string) => {
      if (key.includes(":recovery:")) throw new Error("quota");
      wrote = true;
    },
    removeItem: () => {},
  };
  expect(() =>
    savePersonalSettings(storage, { appearance: { fields: { mode: "dark" } } }, true),
  ).toThrow("quota");
  expect(wrote).toBe(false);
});
