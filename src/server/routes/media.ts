import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { listArticles } from "../../lib/server/articles";
import {
  deleteMedia,
  listMedia,
  MediaError,
  readMedia,
  uploadMedia,
  type MediaScope,
  MEDIA_BYTE_LIMIT,
  detectMediaFormat,
} from "../../lib/server/media";
import { ApiError, mapError } from "../errors";
import { currentProject } from "../project";
import {
  mediaPreferences,
  prepareMedia,
  preparedImage,
  commitMedia,
} from "../../lib/server/media-preparation";
import { record } from "../../shared/panel-settings";

export function registerMediaRoutes(app: Hono, stateDir?: string) {
  const limit = bodyLimit({
    maxSize: MEDIA_BYTE_LIMIT + 1024 * 1024,
    onError: (context) => context.json({ message: "上传请求过大，单张图片上限为 20 MB。" }, 413),
  });
  app.use("/api/media", limit);
  app.use("/api/media/*", limit);
  app.get("/api/media", async (context) => {
    const report = await currentProject();
    const [media, articles] = await Promise.all([listMedia(report), listArticles(report)]);
    return context.json({
      report,
      media,
      articles: articles.filter((item) => !item.error).map(({ id, title }) => ({ id, title })),
      preferences: await mediaPreferences(report, stateDir),
    });
  });

  app.post("/api/media", async (context) => {
    try {
      const form = await context.req.formData();
      const scope = form.get("scope");
      const file = form.get("file");
      if (scope !== "public" && scope !== "article") throw new MediaError("媒体范围无效");
      if (!(file instanceof File) || !file.name) throw new MediaError("请选择图片文件");
      if (file.size > MEDIA_BYTE_LIMIT) throw new MediaError("单个图片不能超过 20 MB");
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
  app.post("/api/media/prepare", async (context) => {
    try {
      const form = await context.req.formData();
      const file = form.get("file");
      const scope = form.get("scope");
      if (!(file instanceof File) || !file.name || (scope !== "public" && scope !== "article"))
        throw new MediaError("请选择图片和有效的资源范围。");
      if (file.size > MEDIA_BYTE_LIMIT) throw new MediaError("单个图片不能超过 20 MB");
      const settingsVersion = form.get("settingsVersion");
      if (typeof settingsVersion !== "string") throw new MediaError("请先读取媒体偏好。");
      return context.json(
        await prepareMedia(
          await currentProject(),
          {
            name: file.name,
            bytes: Buffer.from(await file.arrayBuffer()),
            scope,
            folder: String(form.get("folder") ?? ""),
            articleId: scope === "article" ? String(form.get("articleId") ?? "") : undefined,
            projectKey: String(form.get("projectKey") ?? ""),
            settingsVersion: settingsVersion || null,
          },
          stateDir,
        ),
      );
    } catch (error) {
      mapError(error);
    }
  });
  app.post("/api/media/commit", async (context) => {
    const body: unknown = await context.req.json().catch(() => null);
    if (
      !record(body) ||
      typeof body.token !== "string" ||
      (body.variant !== "original" && body.variant !== "processed")
    )
      throw new ApiError(400, "上传预览参数无效。");
    try {
      return context.json(
        await commitMedia(await currentProject(), body.token, body.variant, stateDir),
        201,
      );
    } catch (error) {
      mapError(error);
    }
  });
  app.get("/api/media/prepared", async (context) => {
    const token = context.req.query("token");
    const variant = context.req.query("variant");
    if (!token || (variant !== "original" && variant !== "processed"))
      throw new ApiError(400, "图片预览参数无效。");
    try {
      const bytes = await preparedImage(await currentProject(), token, variant);
      const extension = detectMediaFormat(bytes);
      const type = (
        {
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".avif": "image/avif",
          ".svg": "image/svg+xml",
        } as Record<string, string>
      )[extension ?? ""];
      return context.body(Uint8Array.from(bytes), 200, {
        "content-type": type,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
      });
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
        "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
      });
    } catch (error) {
      mapError(error);
    }
  });
}
