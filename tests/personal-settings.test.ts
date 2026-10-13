import { expect, it } from "vitest";
import { emptyDocument, parseSettings, patchSettings } from "../src/shared/panel-settings";
import {
  legacyThemeKey,
  personalSettingsKey,
  readPersonalSettings,
  recoverPersonalSettings,
  savePersonalSettings,
  storageFailureMessage,
} from "../src/client/settings/personal-storage";

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}
it("uses the current defaults without writing a new profile and migrates the old theme once", () => {
  const storage = memory();
  expect(readPersonalSettings(storage).document.values.appearance).toMatchObject({
    mode: "system",
    hue: 200,
    fontSize: 14,
  });
  expect(storage.data.size).toBe(0);
  const old = JSON.stringify({ mode: "dark", hue: 201.8 });
  storage.setItem(legacyThemeKey, old);
  expect(readPersonalSettings(storage).document.values.appearance).toMatchObject({
    mode: "dark",
    hue: 202,
  });
  expect(storage.getItem(legacyThemeKey)).toBeNull();
  expect(storage.getItem(`${personalSettingsKey}:legacy-theme-backup`)).toBe(old);
  const migrated = storage.getItem(personalSettingsKey);
  readPersonalSettings(storage);
  expect(storage.getItem(personalSettingsKey)).toBe(migrated);
});
it("retains the old theme and temporary values when migration cannot be saved", () => {
  const storage = memory();
  storage.setItem(legacyThemeKey, '{"mode":"light","hue":95}');
  storage.setItem = () => {
    throw new Error("quota");
  };
  const result = readPersonalSettings(storage);
  expect(result.document.values.appearance.hue).toBe(95);
  expect(result.warnings.join()).toContain("临时加载");
  expect(storage.getItem(legacyThemeKey)).not.toBeNull();
});
it("merges different groups and rejects a stale group without overwriting its latest value", () => {
  const storage = memory();
  const initial = readPersonalSettings(storage).document;
  savePersonalSettings(storage, {
    appearance: { fields: { hue: 120 }, base: initial.values.appearance },
  });
  savePersonalSettings(storage, {
    notifications: { fields: { duration: 7000 }, base: initial.values.notifications },
  });
  expect(() =>
    savePersonalSettings(storage, {
      appearance: { fields: { hue: 200 }, base: initial.values.appearance },
    }),
  ).toThrow("其他位置修改");
  expect(readPersonalSettings(storage).document.values).toMatchObject({
    appearance: { hue: 120 },
    notifications: { duration: 7000 },
  });
});
it("validates all changed groups before one write and preserves invalid input in storage", () => {
  const storage = memory();
  const before = readPersonalSettings(storage).document;
  expect(() =>
    savePersonalSettings(storage, {
      appearance: { fields: { hue: 110 }, base: before.values.appearance },
      notifications: { fields: { duration: 2 } },
    }),
  ).toThrow("无效");
  expect(storage.getItem(personalSettingsKey)).toBeNull();
  const raw = JSON.stringify({
    ...emptyDocument("browser"),
    values: { appearance: { hue: "bad", mode: "dark", fontSize: 99 }, custom: { untouched: true } },
  });
  storage.setItem(personalSettingsKey, raw);
  const recovered = readPersonalSettings(storage);
  expect(recovered.document.values.appearance).toMatchObject({
    mode: "dark",
    hue: 200,
    fontSize: 14,
  });
  expect(recovered.warnings).toHaveLength(2);
  expect(storage.getItem(personalSettingsKey)).toBe(raw);
  savePersonalSettings(storage, { notifications: { fields: { duration: 6000 } } });
  expect(readPersonalSettings(storage).document.values.custom).toEqual({ untouched: true });
});
it("keeps corrupt and future data intact and backs up explicitly recovered corrupt data", () => {
  const storage = memory();
  storage.setItem(personalSettingsKey, "broken-json");
  expect(readPersonalSettings(storage).readOnly).toBe(true);
  expect(() => savePersonalSettings(storage, { appearance: { fields: { hue: 10 } } })).toThrow(
    "原数据已保留",
  );
  recoverPersonalSettings(storage);
  expect(
    [...storage.data.entries()].some(
      ([key, value]) => key.includes(":recovery:") && value === "broken-json",
    ),
  ).toBe(true);
  storage.setItem(personalSettingsKey, '{"schemaVersion":99,"differentShape":true}');
  expect(readPersonalSettings(storage).readOnly).toBe(true);
  expect(() => recoverPersonalSettings(storage)).toThrow("更新版本");
  expect(storage.getItem(personalSettingsKey)).toContain('"schemaVersion":99');
});
it("backs up known old schemas, handles disabled storage and rejects unknown fields", () => {
  const storage = memory();
  const legacy = JSON.stringify({ ...emptyDocument("browser"), schemaVersion: 0 });
  storage.setItem(personalSettingsKey, legacy);
  const result = savePersonalSettings(storage, { appearance: { fields: { hue: 25 } } });
  expect(result.document.schemaVersion).toBe(1);
  expect(storage.getItem(`${personalSettingsKey}:migration-backup`)).toBe(legacy);
  expect(
    readPersonalSettings({
      ...storage,
      getItem: () => {
        throw new Error("disabled");
      },
    }).warnings.join(),
  ).toContain("存储不可用");
  expect(() =>
    patchSettings(emptyDocument("browser"), "browser", "appearance", { token: "secret" }, "test"),
  ).toThrow("无效");
  expect(parseSettings('{"schemaVersion":2,"values":{}}', "browser").readOnly).toBe(true);
  expect(storageFailureMessage(new DOMException("quota", "QuotaExceededError"))).toContain(
    "存储空间不足",
  );
  expect(() =>
    savePersonalSettings(
      {
        ...storage,
        getItem: () => {
          throw new Error("disabled");
        },
      },
      { appearance: { fields: { hue: 50 } } },
    ),
  ).toThrow("存储不可用");
});
