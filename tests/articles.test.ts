import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type { ProjectReport } from '../src/lib/server/project';
import { articleFields, ArticleValidationError, frontmatterEntries, parseArticleSource, patchArticleFrontmatter, patchArticleSource } from '../src/lib/server/article-format';
import { createArticle, deleteArticle, listArticles, readArticle, renameArticle, saveArticleFields, saveArticleSource } from '../src/lib/server/articles';
import { StorageConflict } from '../src/lib/server/storage';

const dirs: string[] = [];
async function fixture(mode: 'local' | 'external'): Promise<ProjectReport> {
  const base = await mkdtemp(path.join(tmpdir(), 'mizuki-articles-'));
  dirs.push(base);
  const root = path.join(base, 'site');
  const contentRoot = mode === 'external' ? path.join(base, 'content') : null;
  await mkdir(root);
  if (contentRoot) await mkdir(path.join(contentRoot, 'posts'), { recursive: true });
  else await mkdir(path.join(root, 'src/content/posts'), { recursive: true });
  return { requestedPath: root, root, mode, readOnly: false, contentRoot, warnings: [], mappings: [] };
}
afterEach(async () => {
  for (const directory of dirs.splice(0)) await rm(directory, { recursive: true, force: true });
});

const realPost = path.resolve(process.cwd(), '../Mizuki/src/content/posts/20260518-QML项目部署并使用InnoSetup打包.md');
it.skipIf(!existsSync(realPost))('edits a real Mizuki article without losing unknown metadata or body', async () => {
  const source = await readFile(realPost, 'utf8');
  const original = parseArticleSource(source);
  const fields = articleFields(original.data);
  fields.title = '更新后的标题';
  fields.tags = 'QML, Astro';
  const edited = patchArticleSource(source, fields);
  const parsed = parseArticleSource(edited);
  expect(parsed.data.title).toBe('更新后的标题');
  expect(parsed.data.pubDate).toEqual(original.data.pubDate);
  expect(parsed.data.author).toEqual(original.data.author);
  expect(parsed.parts.body).toBe(original.parts.body);
  expect(source).toBe(await readFile(realPost, 'utf8'));
});
it('preserves MDX JSX and YAML comments while rejecting invalid dates and URLs', () => {
  const source = '---\ntitle: Hello\npublished: 2026-09-27\n# custom comment\ncustom: [one, two]\n---\n\n<MyComponent value={1} />\n';
  const fields = articleFields(parseArticleSource(source).data);
  fields.description = 'contains: colon';
  const patched = patchArticleSource(source, fields);
  expect(patched).toContain('# custom comment');
  expect(patched).toContain('custom:');
  expect(patched.endsWith('<MyComponent value={1} />\n')).toBe(true);
  fields.published = '2026-02-30';
  expect(() => patchArticleSource(source, fields)).toThrow(ArticleValidationError);
  fields.published = '2026-09-27';
  fields.sourceLink = 'javascript:alert(1)';
  expect(() => patchArticleSource(source, fields)).toThrow(ArticleValidationError);
});
it('edits Frontmatter keys and YAML values while preserving the article body', () => {
  const source = '---\ntitle: Hello\npublished: 2026-09-27\n# keep this comment\noldName: old value\ntags: [one]\n---\n\n# Body\n';
  const entries = frontmatterEntries(parseArticleSource(source).data).map((entry) =>
    entry.key === 'oldName' ? { ...entry, key: 'newName', value: '[first, second]' } : entry.key === 'tags' ? { ...entry, value: '[react, mui]' } : entry
  );
  const patched = patchArticleFrontmatter(source, entries);
  const parsed = parseArticleSource(patched);
  expect(parsed.data.oldName).toBeUndefined();
  expect(parsed.data.newName).toEqual(['first', 'second']);
  expect(parsed.data.tags).toEqual(['react', 'mui']);
  expect(parsed.parts.body).toBe('\n# Body\n');
  expect(patched).toContain('# keep this comment');
  expect(() => patchArticleFrontmatter(source, [...entries, { key: 'title', value: 'Duplicate' }])).toThrow(ArticleValidationError);
});
it('manages local articles with optimistic locking, rename, URL collision, and reversible deletion', async () => {
  const report = await fixture('local');
  await createArticle(report, 'nested/first.md', { title: 'First', published: '2026-09-27', draft: true }, '# Body');
  const created = await readArticle(report, 'nested/first.md');
  expect(created.source).toContain('# Body');
  expect((await listArticles(report)).map((entry) => entry.id)).toEqual(['nested/first.md']);
  const fields = { ...created.fields, title: 'Edited', alias: 'nice-url' };
  await saveArticleFields(report, created.id, fields, created.version);
  await expect(saveArticleFields(report, created.id, fields, created.version)).rejects.toBeInstanceOf(StorageConflict);
  const saved = await readArticle(report, created.id);
  await createArticle(report, 'another.mdx', { title: 'Second', published: '2026-09-27', draft: false }, '<Thing />');
  await createArticle(report, 'My New Post.md', { title: 'Slug source', published: '2026-09-27', draft: false }, '');
  await expect(createArticle(report, 'my-new-post.mdx', { title: 'Collision', published: '2026-09-27', draft: false }, '')).rejects.toBeInstanceOf(ArticleValidationError);
  await expect(saveArticleSource(report, 'another.mdx',
    '---\ntitle: Second\npublished: 2026-09-27\nalias: nice-url\n---\n', (await readArticle(report, 'another.mdx')).version)
  ).rejects.toBeInstanceOf(ArticleValidationError);
  await expect(saveArticleSource(report, 'another.mdx',
    '---\ntitle: Second\npublished: 2026-09-27\nslug: my-new-post\n---\n', (await readArticle(report, 'another.mdx')).version)
  ).rejects.toBeInstanceOf(ArticleValidationError);
  await renameArticle(report, created.id, 'renamed.md', saved.version);
  expect((await listArticles(report)).map((entry) => entry.id)).toContain('renamed.md');
  const renamed = await readArticle(report, 'renamed.md');
  const trash = await deleteArticle(report, 'renamed.md', renamed.version);
  expect(await readFile(trash, 'utf8')).toContain('title: Edited');
  expect((await listArticles(report)).map((entry) => entry.id)).not.toContain('renamed.md');
  await rm(trash, { force: true });
});
it('writes external mode directly to content repository posts', async () => {
  const report = await fixture('external');
  await createArticle(report, 'external.mdx', { title: 'External', published: '2026-09-27', draft: false }, '<Widget />');
  expect(await readFile(path.join(report.contentRoot!, 'posts/external.mdx'), 'utf8')).toContain('<Widget />');
  expect(existsSync(path.join(report.root, 'src/content/posts/external.mdx'))).toBe(false);
});



it.skipIf(!existsSync(realPost))('lists the real Mizuki articles without parser errors', async () => {
  const root = path.resolve(process.cwd(), '../Mizuki');
  const report: ProjectReport = { requestedPath: root, root, mode: 'local', readOnly: false,
    contentRoot: null, warnings: [], mappings: [] };
  const articles = await listArticles(report);
  expect(articles.length).toBeGreaterThan(5);
  expect(articles.filter((article) => article.error).map((article) => [article.id, article.error])).toEqual([]);
});


it('rejects path traversal and reserved permalink URLs', async () => {
  const report = await fixture('local');
  await expect(createArticle(report, '../escape.md', { title: 'Bad', published: '2026-09-27', draft: false }, '')).rejects.toBeInstanceOf(ArticleValidationError);
  expect(existsSync(path.join(report.root, 'src/content/escape.md'))).toBe(false);
  await createArticle(report, 'safe.md', { title: 'Safe', published: '2026-09-27', draft: false }, '');
  const article = await readArticle(report, 'safe.md');
  await expect(saveArticleSource(report, 'safe.md',
    '---\ntitle: Safe\npublished: 2026-09-27\npermalink: about\n---\n', article.version)
  ).rejects.toBeInstanceOf(ArticleValidationError);
  expect((await readArticle(report, 'safe.md')).version).toBe(article.version);
});
