import { randomUUID } from "node:crypto";
import { slug as githubSlug } from "github-slugger";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, open, readFile, readdir, rm, unlink } from "node:fs/promises";
import path from "node:path";
import type { ProjectReport } from "./project";
import { assertManagedRealPath, resolveManagedPath } from "./path-guard";
import { defaultStateDir } from "./workspace";
import { readManagedFile, StorageConflict, writeManagedFile } from "./storage";
import {
  articleFields,
  ArticleValidationError,
  frontmatterEntries,
  newArticleSource,
  parseArticleSource,
  patchArticleFrontmatter,
  patchArticleSource,
  validateRoutePath,
  type ArticleFields,
  type FrontmatterEntry,
} from "./article-format";

export interface ArticleListItem {
  id: string;
  title: string;
  description: string;
  image: string;
  published: string;
  draft: boolean;
  format: "md" | "mdx";
  error: string | null;
  alias: string;
  permalink: string;
  slug: string;
  tags: string[];
  category: string;
}
export interface ArticleRecord extends ArticleListItem {
  source: string;
  version: string;
  fields: ArticleFields;
  frontmatter: FrontmatterEntry[];
}

function location(report: ProjectReport) {
  if (report.mode === "blocked") throw new ArticleValidationError("项目内容模式尚未就绪");
  return {
    root: report.contentRoot ?? report.root,
    prefix: report.mode === "external" ? "posts" : "src/content/posts",
  };
}
function writable(report: ProjectReport) {
  if (report.readOnly) throw new ArticleValidationError("当前项目为只读状态，请先处理工作区警告");
  return location(report);
}
export function validateArticleId(input: string): string {
  if (input !== input.trim() || !input || input.includes("\\") || /^[A-Za-z]:/.test(input))
    throw new ArticleValidationError("文章路径必须是 posts 内的相对路径");
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
    throw new ArticleValidationError("文章路径包含不安全的名称");
  if (!/\.(md|mdx)$/i.test(segments.at(-1)!))
    throw new ArticleValidationError("文章文件必须使用 .md 或 .mdx 扩展名");
  return input;
}
function relativePost(report: ProjectReport, id: string) {
  const { prefix } = location(report);
  return prefix + "/" + validateArticleId(id);
}
function backupDir() {
  return path.join(defaultStateDir(), "backups", "articles");
}
function trashDir() {
  return path.join(defaultStateDir(), "trash", "articles");
}

async function collect(root: string, current: string, relative = ""): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const nested = relative ? relative + "/" + entry.name : entry.name;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(root, absolute, nested)));
    else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
      try {
        files.push(validateArticleId(nested));
      } catch {
        /* Never expose unsafe names. */
      }
    }
  }
  return files;
}

export async function listArticles(report: ProjectReport): Promise<ArticleListItem[]> {
  const { root, prefix } = location(report);
  const base = resolveManagedPath(root, prefix);
  const ids = await collect(root, base);
  const items = await Promise.all(
    ids.map(async (id): Promise<ArticleListItem> => {
      const format = id.toLowerCase().endsWith(".mdx") ? "mdx" : "md";
      const fallback = {
        id,
        title: path.basename(id),
        description: "",
        image: "",
        published: "",
        draft: false,
        format,
        error: null,
        alias: "",
        permalink: "",
        slug: "",
        tags: [],
        category: "",
      } as ArticleListItem;
      try {
        const filename = await assertManagedRealPath(root, prefix + "/" + id);
        const parsed = parseArticleSource(await readFile(filename, "utf8"));
        const fields = articleFields(parsed.data);
        return {
          ...fallback,
          title: fields.title,
          description: fields.description,
          image: fields.image,
          published: fields.published,
          draft: fields.draft,
          alias: fields.alias,
          permalink: fields.permalink,
          slug: fields.slug,
          tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
          category: fields.category,
        };
      } catch (error) {
        return { ...fallback, error: error instanceof Error ? error.message : "文章无法读取" };
      }
    }),
  );
  return items.sort((a, b) => b.published.localeCompare(a.published) || a.id.localeCompare(b.id));
}

export async function readArticle(report: ProjectReport, id: string): Promise<ArticleRecord> {
  const { root } = location(report);
  const result = await readManagedFile(root, relativePost(report, id));
  const format = id.toLowerCase().endsWith(".mdx") ? "mdx" : "md";
  try {
    const parsed = parseArticleSource(result.content);
    const fields = articleFields(parsed.data);
    return {
      id,
      source: result.content,
      version: result.version,
      fields,
      frontmatter: frontmatterEntries(parsed.data),
      format,
      title: fields.title,
      description: fields.description,
      image: fields.image,
      published: fields.published,
      draft: fields.draft,
      alias: fields.alias,
      permalink: fields.permalink,
      slug: fields.slug,
      tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
      category: fields.category,
      error: null,
    };
  } catch (error) {
    const fields = articleFields({});
    return {
      id,
      source: result.content,
      version: result.version,
      fields,
      frontmatter: [],
      format,
      title: path.basename(id),
      description: "",
      image: "",
      published: "",
      draft: false,
      alias: "",
      permalink: "",
      slug: "",
      tags: [],
      category: "",
      error: error instanceof Error ? error.message : "Frontmatter 无法解析",
    };
  }
}

function routes(item: Pick<ArticleListItem, "id" | "alias" | "permalink" | "slug">): string[] {
  const slug =
    item.slug ||
    item.id
      .replace(/\.(md|mdx)$/i, "")
      .split("/")
      .map((segment) => githubSlug(segment))
      .join("/")
      .replace(/\/index$/, "");
  const output = ["posts/" + validateRoutePath(slug, "文章 URL").toLowerCase()];
  if (item.alias) {
    const alias = validateRoutePath(item.alias, "alias").replace(/^posts\//i, "");
    output.push("posts/" + alias.toLowerCase());
  }
  if (item.permalink) output.push(validateRoutePath(item.permalink, "permalink").toLowerCase());
  return output;
}

export function articlePreviewPath(item: Pick<ArticleListItem, "id" | "slug">): string {
  const slug =
    item.slug ||
    item.id
      .replace(/\.(md|mdx)$/i, "")
      .split("/")
      .map((segment) => githubSlug(segment))
      .join("/")
      .replace(/\/index$/, "");
  return "/posts/" + validateRoutePath(slug, "文章 URL") + "/";
}
const RESERVED = new Set([
  "about",
  "archive",
  "posts",
  "anime",
  "albums",
  "diary",
  "friends",
  "projects",
  "skills",
  "devices",
  "timeline",
  "ai-tools",
  "rss",
  "atom",
  "api",
  "robots.txt",
  "sitemap-index.xml",
  "_astro",
]);
async function assertUnique(report: ProjectReport, id: string, source: string, excluding?: string) {
  const parsed = parseArticleSource(source);
  const fields = articleFields(parsed.data);
  if (
    fields.permalink &&
    RESERVED.has(validateRoutePath(fields.permalink, "permalink").split("/")[0].toLowerCase())
  )
    throw new ArticleValidationError("自定义 permalink 与站点现有页面路径冲突");
  const candidate = new Set(
    routes({ id, alias: fields.alias, permalink: fields.permalink, slug: fields.slug }),
  );
  const existing = await listArticles(report);
  for (const item of existing) {
    if (item.id.toLowerCase() === excluding?.toLowerCase()) continue;
    if (item.id.toLowerCase() === id.toLowerCase())
      throw new ArticleValidationError("同名文章文件已存在");
    if (routes(item).some((route) => candidate.has(route)))
      throw new ArticleValidationError("文章 URL 与现有文章冲突：" + item.id);
  }
}

export async function createArticle(
  report: ProjectReport,
  id: string,
  fields: Pick<ArticleFields, "title" | "published" | "draft">,
  body: string,
) {
  const { root } = writable(report);
  id = validateArticleId(id);
  if (!/\.(md|mdx)$/.test(id))
    throw new ArticleValidationError("新文章扩展名必须使用小写 .md 或 .mdx");
  const source = newArticleSource(fields, body);
  await assertUnique(report, id, source);
  return writeManagedFile(root, relativePost(report, id), source, null, backupDir());
}

export async function saveArticleSource(
  report: ProjectReport,
  id: string,
  source: string,
  version: string,
) {
  const { root } = writable(report);
  await assertUnique(report, validateArticleId(id), source, id);
  return writeManagedFile(root, relativePost(report, id), source, version, backupDir());
}

export async function saveArticleFields(
  report: ProjectReport,
  id: string,
  fields: ArticleFields,
  version: string,
) {
  const { root } = writable(report);
  const current = await readManagedFile(root, relativePost(report, id));
  if (current.version !== version) throw new StorageConflict("文章已在其他位置修改，请重新加载");
  const source = patchArticleSource(current.content, fields);
  await assertUnique(report, id, source, id);
  return writeManagedFile(root, relativePost(report, id), source, version, backupDir());
}

export async function saveArticleFrontmatter(
  report: ProjectReport,
  id: string,
  entries: FrontmatterEntry[],
  version: string,
) {
  const { root } = writable(report);
  const current = await readManagedFile(root, relativePost(report, id));
  if (current.version !== version) throw new StorageConflict("文章已在其他位置修改，请重新加载");
  const source = patchArticleFrontmatter(current.content, entries);
  await assertUnique(report, id, source, id);
  return writeManagedFile(root, relativePost(report, id), source, version, backupDir());
}

async function transfer(report: ProjectReport, id: string, version: string, target: string) {
  const { root } = writable(report);
  const source = await assertManagedRealPath(root, relativePost(report, id));
  const current = await readManagedFile(root, relativePost(report, id));
  if (current.version !== version) throw new StorageConflict("文章已在其他位置修改，请重新加载");
  if (!(await lstat(source)).isFile()) throw new ArticleValidationError("文章不是普通文件");
  await mkdir(path.dirname(target), { recursive: true });
  const lockPath = source + ".mizuki-panel.lock";
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new StorageConflict("文章正在被其他操作修改");
    throw error;
  }
  let copied = false;
  try {
    await copyFile(source, target, constants.COPYFILE_EXCL);
    copied = true;
    const latest = await readManagedFile(root, relativePost(report, id));
    if (latest.version !== version) throw new StorageConflict("文章在操作期间发生修改");
    await unlink(source);
  } catch (error) {
    if (copied) await rm(target, { force: true });
    throw error;
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}

export async function renameArticle(
  report: ProjectReport,
  id: string,
  nextId: string,
  version: string,
) {
  const { root } = writable(report);
  nextId = validateArticleId(nextId);
  if (!/\.(md|mdx)$/.test(nextId))
    throw new ArticleValidationError("新文章扩展名必须使用小写 .md 或 .mdx");
  if (nextId.toLowerCase() === id.toLowerCase())
    throw new ArticleValidationError("新路径必须与原路径不同");
  const current = await readArticle(report, id);
  if (current.error) throw new ArticleValidationError("请先修复 Frontmatter，再重命名文章");
  await assertUnique(report, nextId, current.source, id);
  const target = await assertManagedRealPath(root, relativePost(report, nextId));
  await transfer(report, id, version, target);
}

export async function deleteArticle(
  report: ProjectReport,
  id: string,
  version: string,
): Promise<string> {
  writable(report);
  const target = path.join(trashDir(), randomUUID() + "-" + path.basename(id));
  await transfer(report, id, version, target);
  return target;
}
