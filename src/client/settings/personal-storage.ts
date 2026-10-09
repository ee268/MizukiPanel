import {
  emptyDocument,
  groupFingerprint,
  parseSettings,
  patchSettings,
  record,
  type PersonalGroup,
  type SettingsSnapshot,
} from "../../shared/panel-settings";

export const personalSettingsKey = "mizuki-panel-preferences";
export const legacyThemeKey = "mizuki-panel-theme";
export class PersonalConflict extends Error {}
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
// Access the getter inside the guarded operations: some browsers throw on localStorage itself.
export const browserSettingsStorage: StorageLike = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};
export function readPersonalSettings(storage: StorageLike): SettingsSnapshot {
  try {
    const raw = storage.getItem(personalSettingsKey);
    if (raw !== null) return parseSettings(raw, "browser");
    const legacy = storage.getItem(legacyThemeKey);
    if (legacy === null) return parseSettings(null, "browser");
    let value: unknown;
    try {
      value = JSON.parse(legacy);
    } catch {
      return {
        ...parseSettings(null, "browser"),
        warnings: ["旧主题数据无法解析，已保留原数据并使用默认主题。"],
      };
    }
    const document = emptyDocument("browser");
    if (record(value)) {
      if (["light", "dark", "system"].includes(String(value.mode)))
        document.values.appearance.mode = value.mode;
      if (typeof value.hue === "number" && Number.isFinite(value.hue))
        document.values.appearance.hue = Math.min(360, Math.max(0, Math.round(value.hue)));
    }
    const serialized = JSON.stringify(document);
    try {
      storage.setItem(personalSettingsKey, serialized);
      if (storage.getItem(personalSettingsKey) !== serialized) throw new Error("迁移校验失败");
      storage.setItem(`${personalSettingsKey}:legacy-theme-backup`, legacy);
      storage.removeItem(legacyThemeKey);
      return parseSettings(serialized, "browser");
    } catch {
      return {
        document,
        version: null,
        readOnly: false,
        warnings: ["旧主题已临时加载，但浏览器无法完成迁移；原数据仍保留。"],
      };
    }
  } catch {
    return {
      ...parseSettings(null, "browser"),
      warnings: ["浏览器存储不可用，偏好只能临时使用。"],
      unavailable: true,
    };
  }
}
export function savePersonalSettings(
  storage: StorageLike,
  patches: Partial<Record<PersonalGroup, { fields: Record<string, unknown>; base?: unknown }>>,
): SettingsSnapshot {
  const current = readPersonalSettings(storage);
  if (current.unavailable) throw new Error("浏览器存储不可用，偏好未保存，当前输入已保留。");
  if (current.readOnly) throw new Error(current.warnings[0]);
  let document = current.document;
  for (const [group, patch] of Object.entries(patches)) {
    if (!patch) continue;
    if (
      patch.base !== undefined &&
      groupFingerprint(current.document.values[group]) !== groupFingerprint(patch.base)
    )
      throw new PersonalConflict("本组设置已在其他位置修改，请重新载入后保存。");
    document = patchSettings(document, "browser", group, patch.fields, crypto.randomUUID());
  }
  const serialized = JSON.stringify(document);
  if (current.document.schemaVersion === 0 && current.raw)
    storage.setItem(`${personalSettingsKey}:migration-backup`, current.raw);
  storage.setItem(personalSettingsKey, serialized);
  if (storage.getItem(personalSettingsKey) !== serialized)
    throw new Error("浏览器未能确认设置保存成功。");
  return parseSettings(serialized, "browser");
}
export function storageFailureMessage(cause: unknown): string {
  if (
    record(cause) &&
    ["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"].includes(String(cause.name))
  )
    return "浏览器存储空间不足，偏好未保存，当前输入已保留。";
  if (record(cause) && cause.name === "SecurityError")
    return "浏览器禁止访问设置存储，修改仍可预览，但尚未保存。";
  return cause instanceof Error ? cause.message : "浏览器无法保存设置。";
}
export function recoverPersonalSettings(storage: StorageLike): SettingsSnapshot {
  const raw = storage.getItem(personalSettingsKey);
  const parsed = parseSettings(raw, "browser");
  if (parsed.document.schemaVersion > 1) throw new Error("不能重置更新版本的设置。");
  if (raw !== null) storage.setItem(`${personalSettingsKey}:recovery:${Date.now()}`, raw);
  const document = emptyDocument("browser");
  document.revision = crypto.randomUUID();
  document.updatedAt = new Date().toISOString();
  const serialized = JSON.stringify(document);
  storage.setItem(personalSettingsKey, serialized);
  if (storage.getItem(personalSettingsKey) !== serialized)
    throw new Error("浏览器未能确认默认设置保存成功。");
  return parseSettings(serialized, "browser");
}
