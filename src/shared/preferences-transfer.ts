import {
  defaultValues,
  emptyDocument,
  patchSettings,
  record,
  SettingsValidationError,
  type SettingsScope,
} from "./panel-settings";

export type PreferenceGroups = Record<string, Record<string, unknown>>;
export interface PreferenceBundle {
  format: "mizuki-panel-preferences";
  schemaVersion: 1;
  scopes: Partial<Record<SettingsScope, PreferenceGroups>>;
}
export const scopeLabels: Record<SettingsScope, string> = {
  browser: "浏览器",
  machine: "本机",
  project: "项目",
};
export const groupLabels: Record<string, string> = {
  appearance: "外观",
  navigation: "导航",
  notifications: "操作提示",
  editor: "编辑器",
  drafts: "草稿保存",
  logs: "运行日志",
  workspace: "工作区",
  maintenance: "备份保留",
  session: "会话策略",
  preview: "预览",
  publish: "发布",
  access: "只读偏好",
  articleTemplate: "文章模板",
  media: "媒体",
  bangumi: "动画搜索",
};
export function exportPreferenceGroups(
  scope: SettingsScope,
  values: PreferenceGroups,
): PreferenceGroups {
  const defaults = defaultValues(scope);
  return Object.fromEntries(
    Object.entries(defaults).map(([group, fields]) => [
      group,
      Object.fromEntries(
        Object.keys(fields)
          .filter(
            (key) => !(scope === "machine" && group === "workspace" && key === "defaultProject"),
          )
          .map((key) => [
            key,
            scope === "machine" &&
            group === "workspace" &&
            key === "startup" &&
            values[group]?.[key] === "default"
              ? "none"
              : (values[group]?.[key] ?? fields[key]),
          ]),
      ),
    ]),
  );
}
export function validatePreferenceGroups(scope: SettingsScope, input: unknown): PreferenceGroups {
  if (!record(input) || !Object.keys(input).length)
    throw new SettingsValidationError("请选择至少一个设置分组。");
  let document = emptyDocument(scope);
  for (const [group, fields] of Object.entries(input)) {
    if (
      scope === "machine" &&
      group === "workspace" &&
      record(fields) &&
      Object.hasOwn(fields, "defaultProject")
    )
      throw new SettingsValidationError("偏好文件不能导入项目路径关联；请在工作区中选择默认项目。");
    document = patchSettings(document, scope, group, fields, "validation");
  }
  return input as PreferenceGroups;
}
export function parsePreferenceBundle(raw: string): PreferenceBundle {
  if (raw.length > 1024 * 1024) throw new SettingsValidationError("偏好文件不能超过 1 MiB。");
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new SettingsValidationError("偏好文件不是有效 JSON。");
  }
  if (
    !record(input) ||
    input.format !== "mizuki-panel-preferences" ||
    input.schemaVersion !== 1 ||
    !record(input.scopes) ||
    Object.keys(input).some((key) => !["format", "schemaVersion", "scopes"].includes(key))
  )
    throw new SettingsValidationError("偏好文件格式或版本不受支持。");
  if (!Object.keys(input.scopes).length)
    throw new SettingsValidationError("偏好文件没有设置范围。");
  for (const [scope, groups] of Object.entries(input.scopes)) {
    if (!["browser", "machine", "project"].includes(scope))
      throw new SettingsValidationError("偏好文件含未知范围。");
    validatePreferenceGroups(scope as SettingsScope, groups);
  }
  return input as unknown as PreferenceBundle;
}
export function preferenceDiff(before: PreferenceGroups, after: PreferenceGroups) {
  return Object.entries(after).flatMap(([group, fields]) =>
    Object.entries(fields)
      .filter(([field, value]) => JSON.stringify(before[group]?.[field]) !== JSON.stringify(value))
      .map(([field, value]) => ({ group, field, before: before[group]?.[field], after: value })),
  );
}
const fieldLabels: Record<string, Record<string, string>> = {
  bangumi: {
    baseUrl: "Bangumi BaseURL",
    proxyEnabled: "启用代理",
    followSystemProxy: "跟随系统代理",
    proxyUrl: "代理地址",
  },
  session: {
    idleEnabled: "闲置自动退出",
    idleMinutes: "闲置分钟数",
    maximumEnabled: "限制最大有效期",
    maximumHours: "最大有效小时数",
  },
  appearance: { mode: "主题模式", hue: "主题色相", font: "界面字体", fontSize: "界面字号" },
  navigation: {
    sidebar: "侧栏状态",
    lastCollapsed: "记忆的侧栏状态",
    backToTop: "返回顶部按钮",
    backToTopThreshold: "返回顶部显示阈值",
  },
  notifications: { duration: "操作提示时长" },
  editor: {
    defaultMode: "默认编辑模式",
    outline: "默认显示大纲",
    outlineWidth: "大纲宽度",
    bodyFont: "正文字体",
    bodyFontSize: "正文字号",
    bodyLineHeight: "正文行高",
    codeFont: "代码字体",
    codeFontSize: "代码字号",
    tabWidth: "制表宽度",
    spellcheck: "拼写检查",
  },
  drafts: { enabled: "本地草稿保存", delay: "草稿保存延迟" },
  logs: {
    autoScroll: "自动滚动",
    fontSize: "日志字号",
    preview: "预览日志保留条数",
    publish: "发布日志保留条数",
  },
  workspace: { afterConnect: "连接后页面", startup: "启动策略", recentLimit: "最近项目数量" },
  maintenance: { enabled: "启用手动清理规则", days: "保留天数", count: "每个原路径保留数量" },
  preview: { port: "预览端口", path: "默认预览路径" },
  publish: { remember: "记住提交默认值", type: "提交类型", scope: "提交作用域" },
  access: { readOnly: "项目只读" },
  articleTemplate: { body: "模板正文", frontmatter: "默认 Frontmatter", fileName: "文件命名规则" },
  media: {
    scope: "默认上传范围",
    folder: "上传目录",
    naming: "文件命名",
    referenceFormat: "图片引用格式",
    alt: "替代文字",
    compress: "图片压缩",
    quality: "压缩质量",
    resize: "限制图片尺寸",
    maxDimension: "最长边像素",
    format: "转换格式",
  },
};
export const preferenceFieldLabel = (group: string, field: string) =>
  fieldLabels[group]?.[field] ?? field;
