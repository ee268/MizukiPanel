import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type { ProjectReport } from '../src/lib/server/project';
import { deleteMedia, listMedia, MediaError, readMedia, uploadMedia } from '../src/lib/server/media';

const directories: string[] = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

async function fixture(mode: 'local' | 'external'): Promise<ProjectReport> {
  const base = await mkdtemp(path.join(tmpdir(), 'mizuki-media-'));
  directories.push(base);
  const root = path.join(base, 'site');
  const contentRoot = mode === 'external' ? path.join(base, 'content') : null;
  await mkdir(root);
  if (contentRoot) await mkdir(path.join(contentRoot, 'posts'), { recursive: true });
  else await mkdir(path.join(root, 'src/content/posts'), { recursive: true });
  return { requestedPath: root, root, mode, readOnly: false, contentRoot, warnings: [], mappings: [] };
}

afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
});

it('uploads public media, reports references, and blocks deletion while referenced', async () => {
  const report = await fixture('local');
  const article = path.join(report.root, 'src/content/posts/example.md');
  await writeFile(article, '---\ntitle: Example\npublished: 2026-09-27\n---\n\n![pixel](/images/docs/pixel.png)\n');
  expect(await uploadMedia(report, 'public', 'docs/pixel.png', png)).toBe('/images/docs/pixel.png');
  const media = await listMedia(report);
  expect(media).toHaveLength(1);
  expect(media[0].referencedBy).toEqual(['example.md']);
  expect((await readMedia(report, 'public', 'docs/pixel.png')).type).toBe('image/png');
  await expect(deleteMedia(report, 'public', 'docs/pixel.png')).rejects.toBeInstanceOf(MediaError);
  await writeFile(article, '---\ntitle: Example\npublished: 2026-09-27\n---\n');
  const trash = await deleteMedia(report, 'public', 'docs/pixel.png');
  expect(existsSync(path.join(report.root, 'public/images/docs/pixel.png'))).toBe(false);
  expect(await readFile(trash)).toEqual(png);
  await rm(trash, { force: true });
});

it('writes article media beside the selected article in external mode', async () => {
  const report = await fixture('external');
  await mkdir(path.join(report.contentRoot!, 'posts/nested'), { recursive: true });
  await writeFile(path.join(report.contentRoot!, 'posts/nested/note.md'), '---\ntitle: Note\npublished: 2026-09-27\n---\n');
  const reference = await uploadMedia(report, 'article', 'assets/pixel.webp', Buffer.concat([
    Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.from([0])
  ]), 'nested/note.md');
  expect(reference).toBe('./assets/pixel.webp');
  expect(existsSync(path.join(report.contentRoot!, 'posts/nested/assets/pixel.webp'))).toBe(true);
  expect(existsSync(path.join(report.root, 'src/content/posts/nested/assets/pixel.webp'))).toBe(false);
  expect((await listMedia(report))[0].reference).toBe('./assets/pixel.webp');
});

it('rejects traversal, mismatched content, duplicates, and read-only uploads', async () => {
  const report = await fixture('local');
  await expect(uploadMedia(report, 'public', '../escape.png', png)).rejects.toBeInstanceOf(MediaError);
  await expect(uploadMedia(report, 'public', 'fake.png', Buffer.from('not an image'))).rejects.toBeInstanceOf(MediaError);
  await uploadMedia(report, 'public', 'pixel.png', png);
  await expect(uploadMedia(report, 'public', 'pixel.png', png)).rejects.toBeInstanceOf(MediaError);
  await expect(uploadMedia({ ...report, readOnly: true }, 'public', 'other.png', png)).rejects.toBeInstanceOf(MediaError);
});
