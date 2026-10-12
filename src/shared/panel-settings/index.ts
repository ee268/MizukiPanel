import { defaultArticleFrontmatter, validTemplateField } from "./article-template";
import { validMediaFolder } from "../media-settings";
import {
  defaultAiWritingSettings,
  validAiBaseUrl,
  validAiModelId,
  type AiWritingSettings,
} from "../ai-writing";
import { containsApiCredential } from "../api-credentials";
import { validMediaStorageFolder } from "../project-media";
import { commitTypes, validCommitScope, validPreviewPath } from "../task-settings";
import {
  bangumiNetworkProblem,
  defaultBangumiNetworkSettings,
  validBangumiBaseUrl,
  validBangumiProxyUrl,
  type BangumiNetworkSettings,
  type BangumiProjectBaseUrl,
} from "../bangumi-settings";
export const settingsSchemaVersion = 1;
export type SettingsScope = "browser" | "machine" | "project";
export interface AppearanceSettings {
  mode: "light" | "dark" | "system";
  hue: number;
  font: "panel" | "system";
  fontSize: number;
}
export interface NavigationSettings {
  sidebar: "collapsed" | "expanded" | "remember";
  lastCollapsed: boolean;
  backToTop: boolean;
  backToTopThreshold: number;
}
export interface PersonalSettings {
  appearance: AppearanceSettings;
  navigation: NavigationSettings;
  notifications: { duration: number };
  editor: EditorSettings;
  ai: AiWritingSettings;
  drafts: { enabled: boolean; delay: number };
  logs: { autoScroll: boolean; fontSize: number };
  workspace: {
    afterConnect: "/" | "/articles" | "/config" | "/features" | "/media" | "/preview" | "/publish";
  };
}
export interface ArticleTemplateSettings {
  body: string;
  frontmatter: string;
  fileName: string;
}
export interface EditorSettings {
  defaultMode: "auto" | "ir" | "wysiwyg" | "sv";
  outline: boolean;
  outlineWidth: number;
  bodyFont: "project" | "system" | "panel";
  bodyFontSize: number;
  bodyLineHeight: number;
  codeFont: "project" | "panel" | "system";
  codeFontSize: "relative" | number;
  tabWidth: 2 | 4 | 8;
  spellcheck: boolean;
}
export type PersonalGroup = keyof PersonalSettings;
export interface SettingsDocument {
  schemaVersion: number;
  revision: string;
  updatedAt: string | null;
  values: Record<string, Record<string, unknown>>;
}
export interface SettingsSnapshot {
  document: SettingsDocument;
  version: string | null;
  readOnly: boolean;
  warnings: string[];
  raw?: string;
  unavailable?: boolean;
}
export interface SettingsOverview {
  machine: SettingsSnapshot;
  bangumiDefault?: BangumiProjectBaseUrl;
  project: {
    key: string;
    articleKey: string;
    name: string;
    root: string;
    settings: SettingsSnapshot;
    readOnlyInfo?: { detected: boolean; preference: boolean; settings: boolean };
  } | null;
  warnings: string[];
}
type Field = { default: unknown; valid: (value: unknown) => boolean };
const choice = (value: string, choices: readonly string[]): Field => ({
  default: value,
  valid: (input) => typeof input === "string" && choices.includes(input),
});
const number = (value: number, min: number, max: number): Field => ({
  default: value,
  valid: (input) =>
    typeof input === "number" &&
    Number.isFinite(input) &&
    Number.isInteger(input) &&
    input >= min &&
    input <= max,
});
const flag = (value: boolean): Field => ({
  default: value,
  valid: (input) => typeof input === "boolean",
});
// Scoped groups establish storage contracts here; their business behavior is wired in later stages.
const definitions: Record<SettingsScope, Record<string, Record<string, Field>>> = {
  browser: {
    appearance: {
      mode: choice("system", ["light", "dark", "system"]),
      hue: number(240, 0, 360),
      font: choice("panel", ["panel", "system"]),
      fontSize: number(14, 12, 20),
    },
    navigation: {
      sidebar: choice("collapsed", ["collapsed", "expanded", "remember"]),
      lastCollapsed: flag(true),
      backToTop: flag(true),
      backToTopThreshold: number(240, 100, 1000),
    },
    notifications: { duration: number(3500, 2000, 10000) },
    drafts: { enabled: flag(true), delay: number(2000, 1000, 10000) },
    logs: { autoScroll: flag(true), fontSize: number(12, 10, 24) },
    ai: {
      provider: choice(defaultAiWritingSettings.provider, ["openai", "anthropic"]),
      openaiBaseUrl: { default: defaultAiWritingSettings.openaiBaseUrl, valid: validAiBaseUrl },
      anthropicBaseUrl: {
        default: defaultAiWritingSettings.anthropicBaseUrl,
        valid: validAiBaseUrl,
      },
      openaiModel: {
        default: "",
        valid: (value) =>
          typeof value === "string" &&
          value.length <= 160 &&
          !/[\x00-\x1f\x7f]/.test(value) &&
          !containsApiCredential(value),
      },
      anthropicModel: {
        default: "",
        valid: (value) =>
          typeof value === "string" &&
          value.length <= 160 &&
          !/[\x00-\x1f\x7f]/.test(value) &&
          !containsApiCredential(value),
      },
      openaiModels: {
        default: [],
        valid: (value) =>
          Array.isArray(value) &&
          value.length <= 100 &&
          value.every((item) => validAiModelId(item) && item.trim()) &&
          new Set(value).size === value.length,
      },
      anthropicModels: {
        default: [],
        valid: (value) =>
          Array.isArray(value) &&
          value.length <= 100 &&
          value.every((item) => validAiModelId(item) && item.trim()) &&
          new Set(value).size === value.length,
      },
      systemPrompt: {
        default: defaultAiWritingSettings.systemPrompt,
        valid: (value) =>
          typeof value === "string" && value.length <= 8000 && !containsApiCredential(value),
      },
      maxTokens: number(defaultAiWritingSettings.maxTokens, 256, 16384),
    },
    workspace: {
      afterConnect: choice("/", [
        "/",
        "/articles",
        "/config",
        "/features",
        "/media",
        "/preview",
        "/publish",
      ]),
    },
    editor: {
      defaultMode: choice("auto", ["auto", "ir", "wysiwyg", "sv"]),
      outline: flag(false),
      outlineWidth: number(250, 180, 420),
      bodyFont: choice("project", ["project", "system", "panel"]),
      bodyFontSize: number(16, 12, 24),
      bodyLineHeight: {
        default: 1.85,
        valid: (value) =>
          typeof value === "number" && Number.isFinite(value) && value >= 1.4 && value <= 2.4,
      },
      codeFont: choice("project", ["project", "panel", "system"]),
      codeFontSize: {
        default: "relative",
        valid: (value) => value === "relative" || number(14, 10, 24).valid(value),
      },
      tabWidth: { default: 4, valid: (value) => value === 2 || value === 4 || value === 8 },
      spellcheck: flag(false),
    },
  },
  machine: {
    bangumi: {
      baseUrl: { default: defaultBangumiNetworkSettings.baseUrl, valid: validBangumiBaseUrl },
      followProjectBaseUrl: flag(defaultBangumiNetworkSettings.followProjectBaseUrl),
      proxyEnabled: flag(defaultBangumiNetworkSettings.proxyEnabled),
      followSystemProxy: flag(defaultBangumiNetworkSettings.followSystemProxy),
      proxyUrl: { default: "", valid: validBangumiProxyUrl },
    },
    session: {
      idleEnabled: flag(false),
      idleMinutes: number(30, 5, 240),
      maximumEnabled: flag(false),
      maximumHours: number(24, 1, 168),
    },
    maintenance: { enabled: flag(false), days: number(30, 1, 3650), count: number(20, 1, 1000) },
    logs: { preview: number(300, 100, 5000), publish: number(500, 100, 5000) },
    workspace: {
      startup: choice("last", ["last", "none", "default"]),
      defaultProject: {
        default: "",
        valid: (value) => typeof value === "string" && /^(?:[a-f0-9]{64})?$/.test(value),
      },
      recentLimit: number(10, 1, 50),
    },
  },
  project: {
    preview: { port: number(4321, 1024, 65535), path: { default: "/", valid: validPreviewPath } },
    publish: {
      remember: flag(false),
      type: choice("feat", commitTypes),
      scope: { default: "content", valid: validCommitScope },
    },
    access: { readOnly: flag(false) },
    articleTemplate: {
      body: { default: "# 开始写作", valid: (value) => validTemplateField("body", value) },
      frontmatter: {
        default: defaultArticleFrontmatter,
        valid: (value) => validTemplateField("frontmatter", value),
      },
      fileName: { default: "", valid: (value) => validTemplateField("fileName", value) },
    },
    media: {
      storageFolder: { default: "", valid: validMediaStorageFolder },
      scope: choice("public", ["public", "article"]),
      folder: {
        default: "",
        valid: validMediaFolder,
      },
      naming: choice("original", ["original", "date", "unique"]),
      referenceFormat: choice("auto", ["auto", "markdown", "html"]),
      alt: choice("filename", ["filename", "empty"]),
      compress: flag(false),
      quality: number(85, 50, 100),
      resize: flag(false),
      maxDimension: number(1920, 64, 8192),
      format: choice("original", ["original", "png", "jpeg", "webp", "avif"]),
    },
  },
};
export class SettingsValidationError extends Error {}
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function defaultValues(scope: SettingsScope): SettingsDocument["values"] {
  return Object.fromEntries(
    Object.entries(definitions[scope]).map(([group, fields]) => [
      group,
      Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.default])),
    ]),
  );
}
export const defaultPersonalSettings = defaultValues("browser") as unknown as PersonalSettings;
export function emptyDocument(scope: SettingsScope): SettingsDocument {
  return {
    schemaVersion: settingsSchemaVersion,
    revision: "initial",
    updatedAt: null,
    values: defaultValues(scope),
  };
}
export function parseSettings(raw: string | null, scope: SettingsScope): SettingsSnapshot {
  if (raw === null)
    return { document: emptyDocument(scope), version: null, readOnly: false, warnings: [] };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {
      document: emptyDocument(scope),
      version: null,
      readOnly: true,
      warnings: ["设置数据无法解析，原数据已保留。"],
      raw,
    };
  }
  if (
    record(value) &&
    Number.isInteger(value.schemaVersion) &&
    (value.schemaVersion as number) > settingsSchemaVersion &&
    !record(value.values)
  ) {
    return {
      document: { ...emptyDocument(scope), schemaVersion: value.schemaVersion as number },
      version: null,
      readOnly: true,
      warnings: ["设置来自更新版本，当前只读，请升级面板后修改。"],
      raw,
    };
  }
  if (
    !record(value) ||
    !Number.isInteger(value.schemaVersion) ||
    (value.schemaVersion as number) < 0 ||
    !record(value.values)
  ) {
    return {
      document: emptyDocument(scope),
      version: null,
      readOnly: true,
      warnings: ["设置数据结构无效，原数据已保留。"],
      raw,
    };
  }
  const warnings: string[] = [];
  const values = { ...value.values } as SettingsDocument["values"];
  for (const [group, fields] of Object.entries(definitions[scope])) {
    const stored = record(values[group]) ? values[group] : {};
    values[group] = { ...stored };
    for (const [key, field] of Object.entries(fields)) {
      if (key in stored && !field.valid(stored[key]))
        warnings.push(`${group}.${key} 无效，已使用默认值。`);
      values[group][key] = field.valid(stored[key]) ? stored[key] : field.default;
    }
  }
  // Previously stored mirrors are explicit overrides. The previous official
  // default becomes project-following without overwriting the original file.
  if (scope === "machine" && record(value.values.bangumi)) {
    const legacy = value.values.bangumi;
    if (!Object.hasOwn(legacy, "followProjectBaseUrl"))
      values.bangumi.followProjectBaseUrl =
        !validBangumiBaseUrl(legacy.baseUrl) ||
        legacy.baseUrl === defaultBangumiNetworkSettings.baseUrl;
  }
  const future = (value.schemaVersion as number) > settingsSchemaVersion;
  if (future) warnings.unshift("设置来自更新版本，当前只读，请升级面板后修改。");
  if (value.schemaVersion === 0) warnings.push("设置将迁移为当前版本，保存时保留迁移副本。");
  return {
    document: {
      schemaVersion: value.schemaVersion as number,
      revision: typeof value.revision === "string" ? value.revision : "legacy",
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
      values,
    },
    version: null,
    readOnly: future,
    warnings,
    raw,
  };
}
export function patchSettings(
  document: SettingsDocument,
  scope: SettingsScope,
  group: string,
  fields: unknown,
  revision: string,
): SettingsDocument {
  if (document.schemaVersion > settingsSchemaVersion)
    throw new SettingsValidationError("不能覆盖更新版本的设置。");
  const definition = Object.hasOwn(definitions[scope], group)
    ? definitions[scope][group]
    : undefined;
  if (!definition || !record(fields) || !Object.keys(fields).length)
    throw new SettingsValidationError("设置分组或字段无效。");
  for (const [key, value] of Object.entries(fields)) {
    if (!Object.hasOwn(definition, key) || !definition[key].valid(value))
      throw new SettingsValidationError(`设置字段 ${group}.${key} 无效。`);
  }
  if (scope === "machine" && group === "bangumi") {
    const problem = bangumiNetworkProblem({
      ...document.values[group],
      ...fields,
    } as unknown as BangumiNetworkSettings);
    if (problem) throw new SettingsValidationError(problem);
  }
  return {
    ...document,
    schemaVersion: settingsSchemaVersion,
    revision,
    updatedAt: new Date().toISOString(),
    values: { ...document.values, [group]: { ...document.values[group], ...fields } },
  };
}
export function personalValues(document: SettingsDocument): PersonalSettings {
  return document.values as unknown as PersonalSettings;
}
export function groupFingerprint(value: unknown): string {
  if (!record(value)) return JSON.stringify(value);
  return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}
