import { access, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { assertManagedRealPath, resolveManagedPath } from './path-guard';

export type ContentMode = 'local' | 'external' | 'blocked';

export interface SourceMapping {
  key: 'posts' | 'spec' | 'data' | 'images' | 'animes' | 'config';
  label: string;
  sourcePath: string;
  resolvedPath?: string;
  exists: boolean;
  note?: string;
}

export interface ProjectReport {
  requestedPath: string;
  root: string;
  mode: ContentMode;
  readOnly: boolean;
  contentRoot: string | null;
  warnings: string[];
  mappings: SourceMapping[];
}

export class ProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectError';
  }
}

function parseMizukiEnv(source: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([^=]+)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    result.set(match[1].trim(), value);
  }
  return result;
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

export async function inspectProject(requestedPath: string): Promise<ProjectReport> {
  const input = requestedPath.trim();
  if (!input || !path.isAbsolute(input)) {
    throw new ProjectError('请输入 Mizuki 项目的绝对路径');
  }

  let root: string;
  try {
    root = await realpath(input);
  } catch {
    throw new ProjectError('项目目录不存在或无法访问');
  }
  if (!(await isDirectory(root))) {
    throw new ProjectError('所选路径不是目录');
  }

  const required = ['package.json', 'src/content.config.ts', 'src/config/index.ts', 'scripts/sync-content.js'];
  for (const relative of required) {
    if (!(await exists(resolveManagedPath(root, relative)))) {
      throw new ProjectError(`目录缺少 Mizuki 必需文件：${relative}`);
    }
  }
  for (const relative of required) {
    try {
      await assertManagedRealPath(root, relative);
    } catch {
      throw new ProjectError('必需文件位于项目目录之外：' + relative);
    }
  }
  let packageInfo: { name?: string; dependencies?: Record<string, string> };
  try {
    packageInfo = JSON.parse(await readFile(resolveManagedPath(root, 'package.json'), 'utf8'));
  } catch {
    throw new ProjectError('无法读取项目的 package.json');
  }
  if (packageInfo.name !== 'mizuki' || !packageInfo.dependencies?.astro) {
    throw new ProjectError('所选目录不是受支持的 Mizuki Astro 项目');
  }

  const envFile = resolveManagedPath(root, '.env');
  if (await exists(envFile)) {
    try {
      await assertManagedRealPath(root, '.env');
    } catch {
      throw new ProjectError('.env 文件位于项目目录之外');
    }
  }
  const env = (await exists(envFile)) ? parseMizukiEnv(await readFile(envFile, 'utf8')) : new Map<string, string>();
  // sync-content.js loads .env after process.env, so .env takes precedence.
  const setting = (key: string): string | undefined => env.get(key) ?? process.env[key];
  const syncFlag = setting('ENABLE_CONTENT_SYNC');
  const syncEnabled = syncFlag !== 'false';
  const configuredContentDir = setting('CONTENT_DIR');
  const contentDir = configuredContentDir
    ? path.resolve(root, configuredContentDir)
    : path.resolve(root, 'content');
  const contentDirExists = await isDirectory(contentDir);
  const remoteConfigured = Boolean(setting('CONTENT_REPO_URL'));
  const warnings: string[] = [];

  let mode: ContentMode;
  let contentRoot: string | null = null;
  if (!syncEnabled) {
    mode = 'local';
  } else if (contentDirExists) {
    mode = 'external';
    contentRoot = await realpath(contentDir);
    if (!(await exists(path.join(contentRoot, '.git')))) {
      warnings.push('内容目录不是 Git 工作树；后续发布流程需要独立仓库。');
    }
    warnings.push('当前同步脚本可能重置未提交的内容。阶段 2 完成安全同步改造前，独立仓库模式只读。');
  } else {
    mode = 'blocked';
    warnings.push(remoteConfigured
      ? '已配置独立内容仓库，但本地内容目录尚不存在；请先完成克隆或同步。'
      : 'Mizuki 当前同步脚本在 ENABLE_CONTENT_SYNC 未明确设为 false 时默认尝试同步。请在 .env 中明确选择本地模式或配置独立内容仓库。');
  }
  if (!syncFlag) {
    warnings.push('未显式设置 ENABLE_CONTENT_SYNC；面板按 sync-content.js 的实际默认行为判定模式。');
  }

  const sourceRoot = mode === 'external' ? contentRoot! : root;
  const entries: Array<{ key: SourceMapping['key']; label: string; local: string; external: string; note?: string }> = [
    { key: 'posts', label: '博客文章', local: 'src/content/posts', external: 'posts' },
    { key: 'spec', label: '关于与友链正文', local: 'src/content/spec', external: 'spec' },
    { key: 'data', label: '特色页结构化数据', local: 'src/data', external: 'data' },
    { key: 'images', label: '公共图片与相册', local: 'public/images', external: 'images' },
    { key: 'animes', label: '追番季度内容', local: 'src/content/animes', external: 'animes', note: mode === 'external' ? '当前 Mizuki 同步脚本尚未映射此目录；阶段 2 处理。' : undefined },
    { key: 'config', label: '站点配置', local: 'src/config', external: 'overrides', note: mode === 'external' ? '独立仓库使用 overrides；由 Mizuki 构建时深合并。' : undefined }
  ];
  const mappings: SourceMapping[] = await Promise.all(entries.map(async (entry) => {
    const relative = mode === 'external' ? entry.external : entry.local;
    const sourcePath = resolveManagedPath(sourceRoot, relative);
    const present = await isDirectory(sourcePath);
    const resolvedPath = present ? await realpath(sourcePath) : undefined;
    return {
      key: entry.key,
      label: entry.label,
      sourcePath,
      exists: present,
      ...(resolvedPath && resolvedPath !== sourcePath ? { resolvedPath } : {}),
      ...(entry.note ? { note: entry.note } : {})
    };
  }));
  const escapedMappings = mappings.filter((mapping) => {
    if (!mapping.resolvedPath) return false;
    const relative = path.relative(sourceRoot, mapping.resolvedPath);
    return relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
  });
  if (escapedMappings.length) {
    warnings.push('部分内容目录通过链接指向管理根目录之外：' + escapedMappings.map((entry) => entry.label).join('、') + '。请确认模式与链接后再编辑。');
  }

  return {
    requestedPath: input,
    root,
    mode,
    readOnly: mode !== 'local' || escapedMappings.length > 0,
    contentRoot,
    warnings,
    mappings
  };
}
