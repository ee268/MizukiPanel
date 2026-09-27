import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type { ProjectReport } from '../src/lib/server/project';
import {
  commitSelected, publishDiff, publishOverview, PublishError, revertPanelCommit, validateCommitMessage
} from '../src/lib/server/publish';

const directories: string[] = [];

function git(root: string, ...args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

async function fixture(): Promise<{ root: string; report: ProjectReport }> {
  const root = await mkdtemp(path.join(tmpdir(), 'mizuki-publish-'));
  directories.push(root);
  await mkdir(path.join(root, 'src/content/posts'), { recursive: true });
  await mkdir(path.join(root, 'src/config'), { recursive: true });
  await writeFile(path.join(root, 'src/content/posts/one.md'), '# One\n');
  await writeFile(path.join(root, 'src/config/siteConfig.ts'), 'export const siteConfig = {};\n');
  await writeFile(path.join(root, 'README.md'), '# Fixture\n');
  git(root, 'init');
  git(root, 'config', 'user.name', 'MizukiPanel Test');
  git(root, 'config', 'user.email', 'panel@example.invalid');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'chore(test): initialize fixture');
  const report: ProjectReport = {
    requestedPath: root,
    root,
    mode: 'local',
    readOnly: false,
    contentRoot: null,
    warnings: [],
    mappings: [
      { key: 'posts', label: '文章', sourcePath: path.join(root, 'src/content/posts'), exists: true },
      { key: 'config', label: '配置', sourcePath: path.join(root, 'src/config'), exists: true },
    ]
  };
  return { root, report };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it('separates managed content changes from unrelated repository files', async () => {
  const { root, report } = await fixture();
  await writeFile(path.join(root, 'src/content/posts/one.md'), '# Updated\n');
  await writeFile(path.join(root, 'notes.txt'), 'unrelated\n');

  const overview = await publishOverview(report);
  expect(overview.changes.find((change) => change.path === 'src/content/posts/one.md')).toMatchObject({ managed: true, staged: false });
  expect(overview.changes.find((change) => change.path === 'notes.txt')).toMatchObject({ managed: false, staged: false });
  expect(overview.canCommit).toBe(true);
  expect(overview.checks.find((check) => check.key === 'unmanaged')?.status).toBe('warning');
});

it('commits only selected managed files and leaves other changes untouched', async () => {
  const { root, report } = await fixture();
  await writeFile(path.join(root, 'src/content/posts/one.md'), '# Published\n');
  await writeFile(path.join(root, 'src/config/siteConfig.ts'), 'export const siteConfig = { title: "Draft" };\n');
  await writeFile(path.join(root, 'README.md'), '# Local edit\n');

  const result = await commitSelected(report, ['src/content/posts/one.md'], 'feat(content): publish selected post');
  expect(result.subject).toBe('feat(content): publish selected post');
  expect(git(root, 'show', '--format=', '--name-only', 'HEAD')).toBe('src/content/posts/one.md');
  expect(git(root, 'show', 'HEAD:src/content/posts/one.md')).toBe('# Published');
  const status = git(root, 'status', '--short');
  expect(status).toContain('src/config/siteConfig.ts');
  expect(status).toContain('README.md');
});

it('previews new text files and rejects unmanaged selections', async () => {
  const { root, report } = await fixture();
  await writeFile(path.join(root, 'src/content/posts/new.md'), '# New\n');
  await writeFile(path.join(root, 'outside.txt'), 'outside\n');
  expect(await publishDiff(report, 'src/content/posts/new.md')).toContain('+# New');
  await expect(publishDiff(report, 'outside.txt')).rejects.toBeInstanceOf(PublishError);
});

it('creates an explicit revert commit only for the last panel commit', async () => {
  const { root, report } = await fixture();
  await writeFile(path.join(root, 'src/content/posts/one.md'), '# Published\n');
  const published = await commitSelected(report, ['src/content/posts/one.md'], 'feat(content): publish post');
  const restored = await revertPanelCommit(report);
  expect(restored.sha).not.toBe(published.sha);
  expect((await readFile(path.join(root, 'src/content/posts/one.md'), 'utf8')).replaceAll('\r\n', '\n')).toBe('# One\n');
  expect(git(root, 'log', '-1', '--format=%s')).toContain('Revert');
});

it('requires Conventional Commits and refuses pre-existing staged changes', async () => {
  expect(() => validateCommitMessage('publish content')).toThrow(PublishError);
  expect(validateCommitMessage('docs(posts): update article')).toBe('docs(posts): update article');
  const { root, report } = await fixture();
  await writeFile(path.join(root, 'README.md'), '# Staged\n');
  await writeFile(path.join(root, 'src/content/posts/one.md'), '# Updated\n');
  git(root, 'add', 'README.md');
  await expect(commitSelected(report, ['src/content/posts/one.md'], 'feat(content): publish post')).rejects.toThrow('暂存区已有内容');
  expect(git(root, 'diff', '--cached', '--name-only')).toBe('README.md');
});
