import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArticleSource, ArticleValidationError } from "./article-format";
import { readArticle, validateArticleId } from "./articles";
import { createMizukiMarkdownProcessor, type PreviewProcessor } from "./markdown-preview-processor";
import { assertManagedRealPath } from "./path-guard";
import type { ProjectReport } from "./project";

interface CachedProcessor {
  processor: PreviewProcessor;
  extendedCss: string;
}

export interface MarkdownDraftPreview {
  html: string;
  css: string;
  hue: number;
  differences: string[];
  milliseconds: number;
}

const processorCache = new Map<string, Promise<CachedProcessor>>();

async function projectFingerprint(root: string): Promise<string> {
  const important = [
    "astro.config.mjs",
    "package.json",
    "pnpm-lock.yaml",
    "src/config/markdownConfig.ts",
    "src/config/permalinkConfig.ts",
    "src/config/siteConfig.ts",
    "src/config/expressiveCodeConfig.ts",
    "src/styles/markdown-extend.styl",
  ];
  const plugins = await readdir(path.join(root, "src/plugins"));
  const files = [...important, ...plugins.map((name) => `src/plugins/${name}`)];
  const details = await Promise.all(
    files.map(async (relative) => {
      try {
        const entry = await stat(path.join(root, relative));
        return `${relative}:${entry.size}:${entry.mtimeMs}`;
      } catch {
        return `${relative}:missing`;
      }
    }),
  );
  return createHash("sha256").update(details.join("\n")).digest("hex").slice(0, 16);
}

async function loadProcessor(
  report: ProjectReport,
  articleId: string,
  fingerprint: string,
): Promise<CachedProcessor> {
  const processor = await createMizukiMarkdownProcessor(
    report.root,
    articleId,
    fingerprint,
    report.mode === "external",
  );
  const filename = path.join(report.root, "src/styles/markdown-extend.styl");
  const source = await readFile(filename, "utf8");
  const projectRequire = createRequire(path.join(report.root, "package.json"));
  const stylus = projectRequire("stylus") as {
    render: (source: string, options: { filename: string }) => string;
  };
  return { processor, extendedCss: stylus.render(source, { filename }) };
}

async function cachedProcessor(report: ProjectReport, articleId: string): Promise<CachedProcessor> {
  const fingerprint = await projectFingerprint(report.root);
  const key = `${report.root}:${report.mode}:${articleId}:${fingerprint}`;
  let pending = processorCache.get(key);
  if (!pending) {
    pending = loadProcessor(report, articleId, fingerprint);
    processorCache.set(key, pending);
    if (processorCache.size > 12) {
      const oldest = processorCache.keys().next().value;
      if (oldest) processorCache.delete(oldest);
    }
  }
  try {
    return await pending;
  } catch (error) {
    processorCache.delete(key);
    throw error;
  }
}

/** Render an unsaved .md body in memory; never modify the connected project. */
export async function renderMarkdownDraft(
  report: ProjectReport,
  articleId: string,
  body: string,
): Promise<MarkdownDraftPreview> {
  const id = validateArticleId(articleId);
  if (!id.toLowerCase().endsWith(".md")) {
    throw new ArticleValidationError("单篇实时预览目前仅支持 .md 文章");
  }
  if (typeof body !== "string" || Buffer.byteLength(body, "utf8") > 2_000_000) {
    throw new ArticleValidationError("正文草稿无效或超过 2 MB");
  }
  const article = await readArticle(report, id);
  const posts = report.mappings.find((entry) => entry.key === "posts");
  if (!posts) throw new ArticleValidationError("项目缺少文章目录");
  const contentRoot = report.contentRoot ?? report.root;
  const relative = path.relative(contentRoot, path.join(posts.sourcePath, id));
  const filename = await assertManagedRealPath(contentRoot, relative);
  const frontmatter = article.error ? {} : parseArticleSource(article.source).data;
  const { processor, extendedCss } = await cachedProcessor(report, id);
  const started = performance.now();
  try {
    const result = await processor.render(body, {
      fileURL: pathToFileURL(filename).href,
      frontmatter,
    });
    return {
      html: result.code,
      css: extendedCss,
      hue: processor.hue,
      differences: processor.differences,
      milliseconds: Math.round(performance.now() - started),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知渲染错误";
    throw new ArticleValidationError(`Markdown 草稿渲染失败：${message}`);
  }
}
