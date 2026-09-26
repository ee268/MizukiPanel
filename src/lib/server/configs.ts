import path from 'node:path';
import type { ProjectReport } from './project';
import { defaultStateDir } from './workspace';
import { readManagedFile, restoreManagedFile, StorageConflict, writeManagedFile } from './storage';
import {
  changedConfigPaths, createOverrideSource, deepMergeConfig, parseConfigInitializer,
  replaceConfigInitializer, type ConfigValue, ConfigValidationError
} from './config-format';

export interface ConfigDescriptor {
  key: string;
  label: string;
  group: string;
  file: string;
  exportName: string;
}

export const CONFIGS: readonly ConfigDescriptor[] = [
  { key: 'siteConfig', label: '站点核心', group: '站点与外观', file: 'siteConfig.ts', exportName: 'siteConfig' },
  { key: 'fullscreenWallpaperConfig', label: '全屏壁纸', group: '站点与外观', file: 'backgroundWallpaper.ts', exportName: 'fullscreenWallpaperConfig' },
  { key: 'profileConfig', label: '个人资料', group: '站点与外观', file: 'profileConfig.ts', exportName: 'profileConfig' },
  { key: 'navBarConfig', label: '导航栏', group: '导航与布局', file: 'navBarConfig.ts', exportName: 'navBarConfig' },
  { key: 'sidebarLayoutConfig', label: '侧边栏布局', group: '导航与布局', file: 'sidebarConfig.ts', exportName: 'sidebarLayoutConfig' },
  { key: 'footerConfig', label: '页脚', group: '导航与布局', file: 'footerConfig.ts', exportName: 'footerConfig' },
  { key: 'commentConfig', label: '评论系统', group: '互动与内容', file: 'commentConfig.ts', exportName: 'commentConfig' },
  { key: 'shareConfig', label: '文章分享', group: '互动与内容', file: 'shareConfig.ts', exportName: 'shareConfig' },
  { key: 'announcementConfig', label: '公告', group: '互动与内容', file: 'announcementConfig.ts', exportName: 'announcementConfig' },
  { key: 'musicPlayerConfig', label: '音乐播放器', group: '互动与内容', file: 'musicConfig.ts', exportName: 'musicPlayerConfig' },
  { key: 'relatedPostsConfig', label: '相关文章', group: '互动与内容', file: 'relatedPostsConfig.ts', exportName: 'relatedPostsConfig' },
  { key: 'randomPostsConfig', label: '随机文章', group: '互动与内容', file: 'randomPostsConfig.ts', exportName: 'randomPostsConfig' },
  { key: 'licenseConfig', label: '许可协议', group: '链接与渲染', file: 'licenseConfig.ts', exportName: 'licenseConfig' },
  { key: 'permalinkConfig', label: '固定链接', group: '链接与渲染', file: 'permalinkConfig.ts', exportName: 'permalinkConfig' },
  { key: 'markdownConfig', label: 'Markdown 增强', group: '链接与渲染', file: 'markdownConfig.ts', exportName: 'markdownConfig' },
  { key: 'expressiveCodeConfig', label: '代码块', group: '链接与渲染', file: 'expressiveCodeConfig.ts', exportName: 'expressiveCodeConfig' },
  { key: 'sakuraConfig', label: '樱花特效', group: '特效', file: 'effectsConfig.ts', exportName: 'sakuraConfig' },
  { key: 'pioConfig', label: 'Live2D 看板娘', group: '特效', file: 'pioConfig.ts', exportName: 'pioConfig' }
];

export class SiteConfigError extends Error {
  constructor(message: string) { super(message); this.name = 'SiteConfigError'; }
}

function descriptor(key: string): ConfigDescriptor {
  const result = CONFIGS.find((item) => item.key === key);
  if (!result) throw new SiteConfigError('未知的站点配置');
  return result;
}

const backupDir = () => path.join(defaultStateDir(), 'backups');

async function optionalFile(root: string, relative: string) {
  try { return await readManagedFile(root, relative); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function countExpressions(value: ConfigValue): number {
  if (typeof value === 'string') return value.startsWith('«expression:') ? 1 : 0;
  if (Array.isArray(value)) return value.reduce<number>((sum, item) => sum + countExpressions(item), 0);
  if (value && typeof value === 'object') return Object.values(value).reduce<number>((sum, item) => sum + countExpressions(item), 0);
  return 0;
}

function target(report: ProjectReport, item: ConfigDescriptor) {
  if (report.mode === 'external') {
    if (!report.contentRoot) throw new SiteConfigError('独立内容仓库不可用');
    return { root: report.contentRoot, relative: `overrides/${item.key}.ts`, exportName: null as string | null };
  }
  return { root: report.root, relative: `src/config/${item.file}`, exportName: item.exportName as string | null };
}

export async function listConfigs(report: ProjectReport) {
  return { report, configs: CONFIGS };
}

export async function readConfig(report: ProjectReport, key: string) {
  const item = descriptor(key);
  const defaultFile = await readManagedFile(report.root, `src/config/${item.file}`);
  const defaults = parseConfigInitializer(defaultFile.content, item.exportName);
  let overrideValue: ConfigValue | null = null;
  let initializer = defaults.initializer;
  let version = defaultFile.version;
  let targetExists = true;
  if (report.mode === 'external') {
    const overrideFile = await optionalFile(report.contentRoot!, `overrides/${item.key}.ts`);
    targetExists = Boolean(overrideFile);
    if (overrideFile) {
      const parsed = parseConfigInitializer(overrideFile.content, null);
      overrideValue = parsed.value;
      initializer = parsed.initializer;
      version = overrideFile.version;
    } else {
      initializer = '{}';
      version = '';
    }
  }
  const effectiveValue = overrideValue === null ? defaults.value : deepMergeConfig(defaults.value, overrideValue);
  const expressions = countExpressions(defaults.value) + countExpressions(overrideValue ?? null);
  return {
    report,
    descriptor: item,
    mode: report.mode,
    readOnly: report.readOnly,
    targetExists,
    version,
    initializer,
    defaultValue: defaults.value,
    overrideValue,
    effectiveValue,
    changedPaths: changedConfigPaths(defaults.value, effectiveValue),
    warnings: expressions ? [`检测到 ${expressions} 个枚举或标识符表达式；面板只展示源码且不会执行它们。`] : []
  };
}

export async function saveConfig(report: ProjectReport, key: string, initializer: string, expectedVersion: string) {
  if (report.readOnly) throw new SiteConfigError('当前工作区只读，无法保存配置');
  const item = descriptor(key);
  const destination = target(report, item);
  const current = await optionalFile(destination.root, destination.relative);
  if ((current?.version ?? '') !== expectedVersion) throw new StorageConflict('配置已在其他位置修改，请重新加载');
  const source = current
    ? replaceConfigInitializer(current.content, destination.exportName, initializer)
    : createOverrideSource(initializer);
  const saved = await writeManagedFile(destination.root, destination.relative, source, current?.version ?? null, backupDir());
  return { config: await readConfig(report, key), backupPath: saved.backupPath };
}

export async function restoreConfig(report: ProjectReport, key: string, backupPath: string, expectedVersion: string) {
  if (report.readOnly) throw new SiteConfigError('当前工作区只读，无法恢复配置');
  const item = descriptor(key);
  const destination = target(report, item);
  await restoreManagedFile(destination.root, destination.relative, backupPath, expectedVersion, backupDir());
  return readConfig(report, key);
}

export { ConfigValidationError };
