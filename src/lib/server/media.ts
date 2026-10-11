import { randomUUID } from "node:crypto";
import { recordArchive, archiveSnapshot } from "./archive-metadata";
import { constants } from "node:fs";
import {
  copyFile,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rm,
  stat,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import type { ProjectReport } from "./project";
import { assertManagedRealPath, resolveManagedPath } from "./path-guard";
import { defaultStateDir } from "./workspace";
import { validateArticleId } from "./articles";
import { encodeMediaPath } from "../../shared/media-settings";
import { MediaError, projectMediaTarget } from "./media-paths";
import { imageExtensions } from "../../shared/project-media";
import { assertProjectMediaLocation, deleteProjectImage } from "./project-media";
export { MediaError } from "./media-paths";

export type MediaScope = "public" | "article" | "project";

export interface MediaItem {
  scope: MediaScope;
  path: string;
  size: number;
  modified: string;
  reference: string;
  referencedBy: string[];
}

export const MEDIA_BYTE_LIMIT = 20 * 1024 * 1024;
const EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"]);

function roots(report: ProjectReport) {
  if (report.mode === "blocked") throw new MediaError("项目内容模式尚未就绪");
  const root = report.contentRoot ?? report.root;
  return {
    root,
    posts: report.mode === "external" ? "posts" : "src/content/posts",
    images: report.mode === "external" ? "images" : "public/images",
  };
}

function writable(report: ProjectReport) {
  if (report.readOnly) throw new MediaError("当前项目为只读状态，请先处理工作区警告");
  return roots(report);
}

export function validateMediaPath(input: string): string {
  if (
    !input ||
    input !== input.trim() ||
    input.includes("\\") ||
    path.isAbsolute(input) ||
    /^[A-Za-z]:/.test(input)
  )
    throw new MediaError("媒体路径必须是目录内的相对路径");
  const segments = input.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.startsWith(".") ||
        /[<>:"|?*\x00-\x1f]/.test(segment) ||
        /[. ]$/.test(segment) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment),
    )
  )
    throw new MediaError("媒体路径包含不安全的名称");
  if (!EXTENSIONS.has(path.extname(input).toLowerCase()))
    throw new MediaError("仅支持 PNG、JPEG、GIF、WebP、AVIF 和 SVG 图片");
  return input;
}

export function detectMediaFormat(buffer: Buffer): string | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return ".png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return ".jpg";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii")))
    return ".gif";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return ".webp";
  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString("ascii") === "ftyp" &&
    /^(avif|avis)$/.test(buffer.subarray(8, 12).toString("ascii"))
  )
    return ".avif";
  if (
    /^\s*(?:<\?xml[^?]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(
      buffer.toString("utf8", 0, Math.min(buffer.length, 4096)),
    )
  )
    return ".svg";
  return null;
}

export function validateMediaBytes(filename: string, bytes: Buffer): void {
  if (!bytes.length) throw new MediaError("图片文件不能为空");
  if (bytes.length > MEDIA_BYTE_LIMIT) throw new MediaError("单个图片不能超过 20 MB");
  const detected = detectMediaFormat(bytes);
  if (!detected) throw new MediaError("图片内容格式不受支持");
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".jpeg" ? detected !== ".jpg" : extension !== detected)
    throw new MediaError("图片扩展名与文件内容不一致");
}

export function mediaTarget(
  report: ProjectReport,
  scope: MediaScope,
  mediaPath: string,
  articleId?: string,
) {
  if (scope === "project") {
    if (!imageExtensions.has(path.extname(mediaPath).toLowerCase()))
      throw new MediaError("图片格式不受支持。");
    return projectMediaTarget(report, mediaPath);
  }
  const base = roots(report);
  mediaPath = validateMediaPath(mediaPath);
  if (scope === "public") {
    return {
      ...base,
      article: undefined,
      relative: `${base.images}/${mediaPath}`,
      reference: `/images/${encodeMediaPath(mediaPath)}`,
    };
  }
  if (!articleId) throw new MediaError("文章图片必须指定文章");
  articleId = validateArticleId(articleId);
  const articleDirectory = path.posix.dirname(articleId);
  const relativeMedia = articleDirectory === "." ? mediaPath : `${articleDirectory}/${mediaPath}`;
  return {
    ...base,
    article: `${base.posts}/${articleId}`,
    relative: `${base.posts}/${relativeMedia}`,
    reference: `./${encodeMediaPath(mediaPath)}`,
  };
}

async function walk(current: string, relative = ""): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const output: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const nested = relative ? `${relative}/${entry.name}` : entry.name;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(absolute, nested)));
    else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      output.push(nested);
  }
  return output;
}

async function articleSources(
  root: string,
  posts: string,
): Promise<Array<{ id: string; source: string }>> {
  const base = resolveManagedPath(root, posts);
  const files = await walkText(base);
  return Promise.all(
    files.map(async (id) => ({ id, source: await readFile(resolveManagedPath(base, id), "utf8") })),
  );
}

async function walkText(current: string, relative = ""): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const output: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const nested = relative ? `${relative}/${entry.name}` : entry.name;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) output.push(...(await walkText(absolute, nested)));
    else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) output.push(nested);
  }
  return output;
}

function referencesFor(
  scope: MediaScope,
  mediaPath: string,
  sources: Array<{ id: string; source: string }>,
): string[] {
  const normalized = mediaPath.replaceAll("\\", "/");
  return sources
    .filter((article) => {
      if (scope === "public")
        return (
          article.source.includes(`/images/${normalized}`) ||
          article.source.includes(`/images/${encodeMediaPath(normalized)}`)
        );
      const articleDir = path.posix.dirname(article.id);
      const relative = path.posix.relative(articleDir === "." ? "" : articleDir, normalized);
      return (
        article.source.includes(`./${relative}`) ||
        article.source.includes(relative) ||
        article.source.includes(encodeMediaPath(relative))
      );
    })
    .map((article) => article.id);
}

function articleReference(
  mediaPath: string,
  sources: Array<{ id: string; source: string }>,
  referencedBy: string[],
): string {
  const candidates = (referencedBy.length ? referencedBy : sources.map(({ id }) => id))
    .filter((id) => {
      const directory = path.posix.dirname(id);
      return directory === "." || mediaPath.startsWith(directory + "/");
    })
    .sort((a, b) => path.posix.dirname(b).length - path.posix.dirname(a).length);
  const directory = candidates.length ? path.posix.dirname(candidates[0]) : ".";
  const relative = path.posix.relative(directory === "." ? "" : directory, mediaPath);
  return relative.startsWith(".") ? encodeMediaPath(relative) : `./${encodeMediaPath(relative)}`;
}

export async function listMedia(report: ProjectReport): Promise<MediaItem[]> {
  const base = roots(report);
  const [publicFiles, postFiles, sources] = await Promise.all([
    walk(resolveManagedPath(base.root, base.images)),
    walk(resolveManagedPath(base.root, base.posts)),
    articleSources(base.root, base.posts),
  ]);
  const articleFiles = postFiles.filter((file) => EXTENSIONS.has(path.extname(file).toLowerCase()));
  const items = await Promise.all([
    ...publicFiles.map(async (file): Promise<MediaItem> => {
      const details = await stat(resolveManagedPath(base.root, `${base.images}/${file}`));
      return {
        scope: "public",
        path: file,
        size: details.size,
        modified: details.mtime.toISOString(),
        reference: `/images/${encodeMediaPath(file)}`,
        referencedBy: referencesFor("public", file, sources),
      };
    }),
    ...articleFiles.map(async (file): Promise<MediaItem> => {
      const details = await stat(resolveManagedPath(base.root, `${base.posts}/${file}`));
      const referencedBy = referencesFor("article", file, sources);
      return {
        scope: "article",
        path: file,
        size: details.size,
        modified: details.mtime.toISOString(),
        reference: articleReference(file, sources, referencedBy),
        referencedBy,
      };
    }),
  ]);
  return items.sort((a, b) => b.modified.localeCompare(a.modified) || a.path.localeCompare(b.path));
}

export async function uploadMedia(
  report: ProjectReport,
  scope: MediaScope,
  mediaPath: string,
  bytes: Buffer,
  articleId?: string,
) {
  writable(report);
  if (scope === "project") await assertProjectMediaLocation(report, mediaPath);
  validateMediaPath(path.basename(mediaPath));
  const target = mediaTarget(report, scope, mediaPath, articleId);
  validateMediaBytes(mediaPath, bytes);
  if (
    target.article &&
    !(await lstat(await assertManagedRealPath(target.root, target.article))).isFile()
  )
    throw new MediaError("所属文章不是普通文件");
  const filename = await assertManagedRealPath(target.root, target.relative);
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.mizuki-panel-${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, "wx");
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(temporary, filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new MediaError("同名媒体文件已存在");
    throw error;
  } finally {
    await handle?.close();
    await rm(temporary, { force: true });
  }
  return target.reference;
}

export async function readMedia(
  report: ProjectReport,
  scope: MediaScope,
  mediaPath: string,
): Promise<{ bytes: Buffer; type: string }> {
  if (scope === "project") {
    if (!imageExtensions.has(path.extname(mediaPath).toLowerCase()))
      throw new MediaError("仅允许读取图片文件。");
    const target = await assertProjectMediaLocation(report, mediaPath);
    return readImageFile(await assertManagedRealPath(target.root, target.relative), true);
  }
  const base = roots(report);
  mediaPath = validateMediaPath(mediaPath);
  const relative =
    scope === "public" ? `${base.images}/${mediaPath}` : `${base.posts}/${mediaPath}`;
  const filename = await assertManagedRealPath(base.root, relative);
  return readImageFile(filename);
}

export async function readImageFile(
  filename: string,
  sourceImage = false,
): Promise<{ bytes: Buffer; type: string }> {
  if (!(await lstat(filename)).isFile()) throw new MediaError("媒体目标不是普通文件");
  const bytes = await readFile(filename);
  const extension =
    detectMediaFormat(bytes) ??
    (sourceImage && imageExtensions.has(path.extname(filename).toLowerCase())
      ? path.extname(filename).toLowerCase()
      : null);
  if (!extension) throw new MediaError("媒体内容格式不受支持");
  const types: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".apng": "image/apng",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".jxl": "image/jxl",
  };
  return { bytes, type: types[extension] };
}

export async function deleteMedia(
  report: ProjectReport,
  scope: MediaScope,
  mediaPath: string,
): Promise<string> {
  if (scope === "project") return deleteProjectImage(report, mediaPath);
  const base = writable(report);
  mediaPath = validateMediaPath(mediaPath);
  const all = await listMedia(report);
  const item = all.find((entry) => entry.scope === scope && entry.path === mediaPath);
  if (!item) throw new MediaError("媒体文件不存在");
  if (item.referencedBy.length)
    throw new MediaError(`媒体仍被 ${item.referencedBy.length} 篇文章引用，请先移除引用`);
  const relative =
    scope === "public" ? `${base.images}/${mediaPath}` : `${base.posts}/${mediaPath}`;
  const source = await assertManagedRealPath(base.root, relative);
  if (!(await lstat(source)).isFile()) throw new MediaError("媒体目标不是普通文件");
  const trash = path.join(
    defaultStateDir(),
    "trash",
    "media",
    randomUUID() + "-" + path.basename(mediaPath),
  );
  await mkdir(path.dirname(trash), { recursive: true });
  await copyFile(source, trash, constants.COPYFILE_EXCL);
  try {
    const metadata = await recordArchive(trash, "trash", base.root, relative, {
      domain: "media",
      projectRoot: report.root,
    });
    if ((await archiveSnapshot(source)).digest !== metadata.digest)
      throw new MediaError("媒体在回收期间发生变化，请重试。");
    await unlink(source);
  } catch (error) {
    await rm(trash, { force: true });
    await rm(trash + ".meta.json", { force: true });
    throw error;
  }
  return trash;
}
