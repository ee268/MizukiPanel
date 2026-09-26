import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertManagedRealPath, PathGuardError, resolveManagedPath } from '../src/lib/server/path-guard';
import { inspectProject, ProjectError } from '../src/lib/server/project';
import { readWorkspacePath, saveWorkspacePath } from '../src/lib/server/workspace';

const temporaryDirectories: string[] = [];

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'mizuki-panel-test-'));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, 'src', 'config'), { recursive: true });
  await mkdir(path.join(root, 'scripts'), { recursive: true });
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'mizuki', dependencies: { astro: '7.1.3' } }));
  await writeFile(path.join(root, 'src', 'content.config.ts'), 'export const collections = {};');
  await writeFile(path.join(root, 'src', 'config', 'index.ts'), 'export const siteConfig = {};');
  await writeFile(path.join(root, 'scripts', 'sync-content.js'), '');
  return root;
}

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('Mizuki project connection', () => {
  it('recognizes explicit local mode and maps original project paths', async () => {
    const root = await fixture();
    await writeFile(path.join(root, '.env'), 'ENABLE_CONTENT_SYNC=false\n');
    await mkdir(path.join(root, 'src', 'content', 'posts'), { recursive: true });

    const report = await inspectProject(root);
    expect(report.mode).toBe('local');
    expect(report.readOnly).toBe(false);
    expect(report.mappings.find((entry) => entry.key === 'posts')?.sourcePath).toBe(path.join(root, 'src', 'content', 'posts'));
    expect(report.mappings.find((entry) => entry.key === 'posts')?.exists).toBe(true);
  });

  it('blocks ambiguous defaults rather than assuming local mode', async () => {
    const root = await fixture();
    const report = await inspectProject(root);
    expect(report.mode).toBe('blocked');
    expect(report.readOnly).toBe(true);
    expect(report.warnings.join(' ')).toContain('ENABLE_CONTENT_SYNC');
  });

  it('maps external content to the content repository and marks it read-only for stage 1', async () => {
    const root = await fixture();
    const contentRoot = path.join(root, 'custom-content');
    await mkdir(path.join(contentRoot, '.git'), { recursive: true });
    await mkdir(path.join(contentRoot, 'posts'), { recursive: true });
    await writeFile(path.join(root, '.env'), 'ENABLE_CONTENT_SYNC=true\nCONTENT_DIR=./custom-content\n');

    const report = await inspectProject(root);
    expect(report.mode).toBe('external');
    expect(report.readOnly).toBe(true);
    expect(report.contentRoot).toBe(contentRoot);
    expect(report.mappings.find((entry) => entry.key === 'posts')?.sourcePath).toBe(path.join(contentRoot, 'posts'));
    expect(report.mappings.find((entry) => entry.key === 'animes')?.note).toContain('阶段 2');
  });

  it('rejects unrelated directories', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'not-mizuki-'));
    temporaryDirectories.push(root);
    await expect(inspectProject(root)).rejects.toBeInstanceOf(ProjectError);
  });
});

describe('path and workspace safety', () => {
  it('rejects traversal and absolute targets', async () => {
    const root = await fixture();
    expect(() => resolveManagedPath(root, '../outside')).toThrow(PathGuardError);
    expect(() => resolveManagedPath(root, 'posts/../outside')).toThrow(PathGuardError);
    expect(() => resolveManagedPath(root, path.join(root, 'outside'))).toThrow(PathGuardError);
    expect(await assertManagedRealPath(root, 'src/content/posts/new.md')).toBe(path.join(root, 'src', 'content', 'posts', 'new.md'));
  });

  it('stores only the selected project path in ignored local state', async () => {
    const root = await fixture();
    const stateDir = path.join(root, 'panel-state');
    await saveWorkspacePath(root, stateDir);
    expect(await readWorkspacePath(stateDir)).toBe(root);
    expect(JSON.parse(await readFile(path.join(stateDir, 'workspace.json'), 'utf8'))).toEqual({ projectPath: root });
  });
});
