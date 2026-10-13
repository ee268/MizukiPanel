import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ArticleAutosaveRequest } from "../../shared/article-autosave";
import type { FrontmatterEntry } from "../../lib/server/article-format";
import {
  articlePreviewPath,
  createArticle,
  createArticleFromSource,
  deleteArticle,
  permanentlyDeleteArticle,
  listArticles,
  readArticle,
  renameArticle,
  saveArticleFrontmatter,
  saveArticleBody,
  saveArticleSource,
  saveArticleAutosave,
} from "../../lib/server/articles";
import type { SourceIslandEdit } from "../../lib/server/article-body-validation";
import { ApiError, mapError } from "../errors";
import { currentProject } from "../project";
import {
  articleProjectKey,
  prepareArticleCreation,
  readArticleTemplate,
} from "../../lib/server/article-template";
import { StorageConflict } from "../../lib/server/storage";

export function registerArticleRoutes(app: Hono, stateDir?: string) {
  async function boundProject(body: { projectKey?: string }) {
    const report = await currentProject();
    if (body.projectKey !== undefined && body.projectKey !== (await articleProjectKey(report)))
      throw new ApiError(409, "当前项目已切换，未将修改写入其他项目。");
    return report;
  }
  app.get("/api/articles", async (context) => {
    const report = await currentProject();
    return context.json({
      report,
      projectKey: await articleProjectKey(report),
      articles: await listArticles(report),
    });
  });

  app.get("/api/article", async (context) => {
    const id = context.req.query("id");
    if (!id) throw new ApiError(400, "缺少文章路径");
    try {
      const report = await currentProject();
      const article = await readArticle(report, id);
      return context.json({
        report,
        projectKey: await articleProjectKey(report),
        article,
        previewPath: article.error ? null : articlePreviewPath(article),
      });
    } catch (error) {
      mapError(error);
    }
  });

  app.get("/api/articles/template", async (context) => {
    try {
      return context.json(await readArticleTemplate(await currentProject(), stateDir));
    } catch (error) {
      mapError(error);
    }
  });
  app.post("/api/articles/preview", async (context) => {
    try {
      return context.json(
        await prepareArticleCreation(await currentProject(), await context.req.json(), stateDir),
      );
    } catch (error) {
      mapError(error);
    }
  });

  app.post("/api/articles", async (context) => {
    const body = await context.req.json<{
      id?: string;
      title?: string;
      published?: string;
      draft?: boolean;
      body?: string;
      frontmatter?: string;
      projectKey?: string;
      settingsVersion?: string | null;
      previewVersion?: string;
    }>();
    if (
      !body ||
      (!body.id && !body.projectKey) ||
      typeof body.title !== "string" ||
      !body.title ||
      typeof body.published !== "string" ||
      !body.published
    )
      throw new ApiError(400, "文章路径、标题和发布日期不能为空");
    try {
      const report = await boundProject(body);
      if (body.projectKey !== undefined) {
        const preview = await prepareArticleCreation(report, body, stateDir);
        if (preview.previewVersion !== body.previewVersion)
          throw new StorageConflict("新建预览已过期，请重新预览后创建。");
        await createArticleFromSource(report, preview.id, preview.source);
        return context.json({ article: await readArticle(report, preview.id) }, 201);
      }
      if (!body.id) throw new ApiError(400, "缺少文章路径");
      await createArticle(
        report,
        body.id,
        { title: body.title, published: body.published, draft: body.draft !== false },
        body.body ?? "",
      );
      return context.json({ article: await readArticle(report, body.id) }, 201);
    } catch (error) {
      mapError(error);
    }
  });

  app.put("/api/article/frontmatter", async (context) => {
    const body = await context.req.json<{
      id?: string;
      version?: string;
      entries?: FrontmatterEntry[];
      projectKey?: string;
    }>();
    if (!body.id || !body.version || !Array.isArray(body.entries))
      throw new ApiError(400, "Frontmatter 保存参数不完整");
    try {
      const report = await boundProject(body);
      await saveArticleFrontmatter(report, body.id, body.entries, body.version);
      const article = await readArticle(report, body.id);
      return context.json({
        article,
        previewPath: article.error ? null : articlePreviewPath(article),
      });
    } catch (error) {
      mapError(error);
    }
  });

  app.put("/api/article/source", async (context) => {
    const body = await context.req.json<{
      id?: string;
      version?: string;
      source?: string;
      projectKey?: string;
    }>();
    if (!body.id || !body.version || typeof body.source !== "string")
      throw new ApiError(400, "源码保存参数不完整");
    try {
      const report = await boundProject(body);
      await saveArticleSource(report, body.id, body.source, body.version);
      const article = await readArticle(report, body.id);
      return context.json({
        article,
        previewPath: article.error ? null : articlePreviewPath(article),
      });
    } catch (error) {
      mapError(error);
    }
  });

  app.put("/api/article/body", async (context) => {
    const body = await context.req.json<{
      id?: string;
      version?: string;
      body?: string;
      sourceEdits?: SourceIslandEdit[];
      projectKey?: string;
    }>();
    if (
      !body.id ||
      !body.version ||
      typeof body.body !== "string" ||
      (body.sourceEdits !== undefined && !Array.isArray(body.sourceEdits))
    ) {
      throw new ApiError(400, "正文保存参数不完整");
    }
    try {
      const report = await boundProject(body);
      await saveArticleBody(report, body.id, body.body, body.version, body.sourceEdits);
      const article = await readArticle(report, body.id);
      return context.json({
        article,
        previewPath: article.error ? null : articlePreviewPath(article),
      });
    } catch (error) {
      mapError(error);
    }
  });

  app.put("/api/article/autosave", bodyLimit({ maxSize: 4 * 1024 * 1024 }), async (context) => {
    const body = await context.req.json<ArticleAutosaveRequest>().catch(() => null);
    if (
      !body ||
      typeof body.id !== "string" ||
      !body.id ||
      typeof body.version !== "string" ||
      !body.version ||
      typeof body.projectKey !== "string" ||
      !body.projectKey ||
      (body.body === undefined && body.entries === undefined) ||
      (body.body !== undefined && typeof body.body !== "string") ||
      (body.entries !== undefined && !Array.isArray(body.entries)) ||
      (body.entries !== undefined &&
        !body.entries.every(
          (entry) =>
            entry &&
            typeof entry.key === "string" &&
            typeof entry.value === "string" &&
            (entry.originalKey === undefined || typeof entry.originalKey === "string") &&
            Object.keys(entry).every((key) => ["key", "value", "originalKey"].includes(key)),
        )) ||
      (body.sourceEdits !== undefined &&
        (!Array.isArray(body.sourceEdits) || body.body === undefined)) ||
      Object.keys(body).some(
        (key) => !["id", "version", "projectKey", "body", "entries", "sourceEdits"].includes(key),
      )
    )
      throw new ApiError(400, "自动保存参数无效。");
    const report = await boundProject(body);
    await saveArticleAutosave(report, body);
    const article = await readArticle(report, body.id);
    return context.json({
      article,
      previewPath: article.error ? null : articlePreviewPath(article),
    });
  });

  app.post("/api/article/rename", async (context) => {
    const body = await context.req.json<{
      id?: string;
      nextId?: string;
      version?: string;
      projectKey?: string;
    }>();
    if (!body.id || !body.nextId || !body.version) throw new ApiError(400, "重命名参数不完整");
    try {
      const report = await boundProject(body);
      await renameArticle(report, body.id, body.nextId, body.version);
      return context.json({ article: await readArticle(report, body.nextId) });
    } catch (error) {
      mapError(error);
    }
  });

  app.delete("/api/article", async (context) => {
    const body = await context.req.json<{
      id?: string;
      version?: string;
      projectKey?: string;
      recycle?: boolean;
    }>();
    if (
      !body ||
      typeof body.id !== "string" ||
      !body.id ||
      typeof body.version !== "string" ||
      !body.version ||
      (body.recycle !== undefined && typeof body.recycle !== "boolean")
    )
      throw new ApiError(400, "删除参数无效");
    try {
      const report = await boundProject(body);
      if (body.recycle === false) await permanentlyDeleteArticle(report, body.id, body.version);
      else await deleteArticle(report, body.id, body.version);
      return context.json({ ok: true, recycled: body.recycle !== false });
    } catch (error) {
      mapError(error);
    }
  });
}
