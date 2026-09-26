import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type { ProjectReport } from '../src/lib/server/project';
import {
  ConfigValidationError, createOverrideSource, deepMergeConfig, parseConfigInitializer, replaceConfigInitializer
} from '../src/lib/server/config-format';
import { readConfig, restoreConfig, saveConfig } from '../src/lib/server/configs';

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map((entry) => rm(entry, { recursive: true, force: true }))); });

it('parses and safely patches static TypeScript config initializers', () => {
  const source = 'import { LinkPreset } from "./types";\nconst SITE_LANG = "zh_CN";\n// keep\nexport const siteConfig: SiteConfig = { title: "Blog", lang: SITE_LANG, links: [LinkPreset.Home], themeColor: { hue: 240, fixed: false } };\n';
  const parsed = parseConfigInitializer(source, 'siteConfig');
  expect(parsed.value).toMatchObject({ title: 'Blog', lang: 'zh_CN', links: ['«expression: LinkPreset.Home»'] });
  const patched = replaceConfigInitializer(source, 'siteConfig', '{ title: "New", themeColor: { hue: 210, fixed: true } }');
  expect(patched).toContain('// keep');
  expect(parseConfigInitializer(patched, 'siteConfig').value).toMatchObject({ title: 'New', themeColor: { hue: 210, fixed: true } });
  expect(() => replaceConfigInitializer(source, 'siteConfig', '{ title: getTitle() }')).toThrow(ConfigValidationError);
  expect(() => createOverrideSource('{ lang: SITE_LANG }')).toThrow(/未声明的标识符/);
  expect(createOverrideSource('{ links: [LinkPreset.Home] }')).toContain('import { LinkPreset }');
  expect(deepMergeConfig({ nested: { keep: true, value: 1 }, list: [1, 2] }, { nested: { value: 2 }, list: [3] }))
    .toEqual({ nested: { keep: true, value: 2 }, list: [3] });
  expect(deepMergeConfig({ value: 'default' }, { value: null })).toEqual({ value: null });
});

it('saves and restores local config and creates external overrides', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mizuki-config-'));
  const contentRoot = path.join(root, 'content');
  temporary.push(root);
  await mkdir(path.join(root, 'src/config'), { recursive: true });
  await mkdir(path.join(contentRoot, 'overrides'), { recursive: true });
  await writeFile(path.join(root, 'src/config/siteConfig.ts'), 'export const siteConfig = { title: "Default", themeColor: { hue: 240, fixed: false } };\n');
  const base: ProjectReport = { requestedPath: root, root, mode: 'local', readOnly: false, contentRoot: null, warnings: [], mappings: [] };
  const local = await readConfig(base, 'siteConfig');
  const saved = await saveConfig(base, 'siteConfig', '{ title: "Local", themeColor: { hue: 120, fixed: true } }', local.version);
  expect(saved.config.effectiveValue).toMatchObject({ title: 'Local', themeColor: { hue: 120 } });
  expect(saved.backupPath).toBeTruthy();
  const restored = await restoreConfig(base, 'siteConfig', saved.backupPath!, saved.config.version);
  expect(restored.effectiveValue).toMatchObject({ title: 'Default', themeColor: { hue: 240 } });

  const externalReport: ProjectReport = { ...base, mode: 'external', contentRoot };
  const external = await readConfig(externalReport, 'siteConfig');
  expect(external.targetExists).toBe(false);
  const overridden = await saveConfig(externalReport, 'siteConfig', '{ themeColor: { hue: 300 } }', external.version);
  expect(overridden.config.effectiveValue).toMatchObject({ title: 'Default', themeColor: { hue: 300, fixed: false } });
  expect(await readFile(path.join(contentRoot, 'overrides/siteConfig.ts'), 'utf8')).toContain('export default');
});
