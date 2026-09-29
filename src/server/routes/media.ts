import type { Hono } from "hono";
import { listArticles } from "../../lib/server/articles";
import {
  deleteMedia,
  listMedia,
  MediaError,
  readMedia,
  uploadMedia,
  type MediaScope,
} from "../../lib/server/media";
import { ApiError, mapError } from "../errors";
import { currentProject } from "../project";
export function registerMediaRoutes(app: Hono) {
  app.get("/api/media", async (context) => {
    const report = await currentProject();
    const [media, articles] = await Promise.all([listMedia(report), listArticles(report)]);
    return context.json({
      report,
      media,
      articles: articles.filter((item) => !item.error).map(({ id, title }) => ({ id, title })),
    });
  });

  app.post("/api/media", async (context) => {
    try {
      const form = await context.req.formData();
      const scope = form.get("scope");
      const file = form.get("file");
      if (scope !== "public" && scope !== "article") throw new MediaError("媒体范围无效");
      if (!(file instanceof File) || !file.name) throw new MediaError("请选择图片文件");
      const folder = String(form.get("folder") ?? "")
        .trim()
        .replace(/^\/+|\/+$/g, "");
      const mediaPath = folder ? `${folder}/${file.name}` : file.name;
      const reference = await uploadMedia(
        await currentProject(),
        scope,
        mediaPath,
        Buffer.from(await file.arrayBuffer()),
        scope === "article" ? String(form.get("articleId") ?? "") : undefined,
      );
      return context.json({ reference }, 201);
    } catch (error) {
      mapError(error);
    }
  });

  app.delete("/api/media", async (context) => {
    const body = await context.req.json<{ scope?: MediaScope; path?: string }>();
    if ((body.scope !== "public" && body.scope !== "article") || !body.path)
      throw new ApiError(400, "媒体删除参数无效");
    try {
      return context.json({
        trash: await deleteMedia(await currentProject(), body.scope, body.path),
      });
    } catch (error) {
      mapError(error);
    }
  });

  app.get("/api/media/file", async (context) => {
    const scope = context.req.query("scope");
    const mediaPath = context.req.query("path");
    if ((scope !== "public" && scope !== "article") || !mediaPath)
      throw new ApiError(400, "媒体参数无效");
    try {
      const media = await readMedia(await currentProject(), scope, mediaPath);
      return context.body(Uint8Array.from(media.bytes), 200, {
        "content-type": media.type,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      });
    } catch (error) {
      mapError(error);
    }
  });
}
