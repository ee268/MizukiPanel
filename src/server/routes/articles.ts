import type { Hono } from "hono";
import type { FrontmatterEntry } from "../../lib/server/article-format";
import {
  articlePreviewPath,
  createArticle,
  deleteArticle,
  listArticles,
  readArticle,
  renameArticle,
  saveArticleFrontmatter,
  saveArticleSource,
} from "../../lib/server/articles";
import { ApiError, mapError } from "../errors";
import { currentProject } from "../project";
export function registerArticleRoutes(app: Hono) {
  app.get("/api/articles", async (context) => {
    const report = await currentProject();
    return context.json({ report, articles: await listArticles(report) });
  });

  app.get("/api/article", async (context) => {
    const id = context.req.query("id");
    if (!id) throw new ApiError(400, "缺少文章路径");
    try {
      const report = await currentProject();
      const article = await readArticle(report, id);
      return context.json({
        report,
        article,
        previewPath: article.error ? null : articlePreviewPath(article),
      });
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
    }>();
    if (!body.id || !body.title || !body.published)
      throw new ApiError(400, "文章路径、标题和发布日期不能为空");
    try {
      const report = await currentProject();
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
    }>();
    if (!body.id || !body.version || !Array.isArray(body.entries))
      throw new ApiError(400, "Frontmatter 保存参数不完整");
    try {
      const report = await currentProject();
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
    const body = await context.req.json<{ id?: string; version?: string; source?: string }>();
    if (!body.id || !body.version || typeof body.source !== "string")
      throw new ApiError(400, "源码保存参数不完整");
    try {
      const report = await currentProject();
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

  app.post("/api/article/rename", async (context) => {
    const body = await context.req.json<{ id?: string; nextId?: string; version?: string }>();
    if (!body.id || !body.nextId || !body.version) throw new ApiError(400, "重命名参数不完整");
    try {
      const report = await currentProject();
      await renameArticle(report, body.id, body.nextId, body.version);
      return context.json({ article: await readArticle(report, body.nextId) });
    } catch (error) {
      mapError(error);
    }
  });

  app.delete("/api/article", async (context) => {
    const body = await context.req.json<{ id?: string; version?: string }>();
    if (!body.id || !body.version) throw new ApiError(400, "删除参数不完整");
    try {
      await deleteArticle(await currentProject(), body.id, body.version);
      return context.json({ ok: true });
    } catch (error) {
      mapError(error);
    }
  });
}
