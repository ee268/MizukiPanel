import type { Hono } from "hono";
import type { ConfigValue } from "../../lib/server/config-format";
import {
  deleteAlbum,
  deleteAnimeSeason,
  featureIndex,
  listAlbums,
  listAnimeSeasons,
  readAnimeSeason,
  readFeatureData,
  readFeatureText,
  restoreFeatureFile,
  saveAlbum,
  saveAnimeSeason,
  saveFeatureData,
  saveFeatureText,
} from "../../lib/server/features";
import { ApiError, mapError } from "../errors";
import { currentProject } from "../project";

export function registerFeatureRoutes(app: Hono) {
  app.get("/api/features", async (context) =>
    context.json(await featureIndex(await currentProject())),
  );

  app.get("/api/feature/data", async (context) => {
    const key = context.req.query("key");
    if (!key) throw new ApiError(400, "缺少数据源名称");
    try {
      return context.json(await readFeatureData(await currentProject(), key));
    } catch (error) {
      mapError(error);
    }
  });
  app.put("/api/feature/data", async (context) => {
    const body = await context.req.json<{ key?: string; value?: ConfigValue; version?: string }>();
    if (!body.key || body.value === undefined || typeof body.version !== "string")
      throw new ApiError(400, "特色页数据保存参数不完整");
    try {
      return context.json(
        await saveFeatureData(await currentProject(), body.key, body.value, body.version),
      );
    } catch (error) {
      mapError(error);
    }
  });
  app.get("/api/feature/text", async (context) => {
    const key = context.req.query("key");
    if (!key) throw new ApiError(400, "缺少正文名称");
    try {
      return context.json(await readFeatureText(await currentProject(), key));
    } catch (error) {
      mapError(error);
    }
  });
  app.put("/api/feature/text", async (context) => {
    const body = await context.req.json<{ key?: string; content?: string; version?: string }>();
    if (!body.key || typeof body.content !== "string" || typeof body.version !== "string")
      throw new ApiError(400, "正文保存参数不完整");
    try {
      return context.json(
        await saveFeatureText(await currentProject(), body.key, body.content, body.version),
      );
    } catch (error) {
      mapError(error);
    }
  });
  app.post("/api/feature/restore", async (context) => {
    const body = await context.req.json<{
      kind?: "data" | "text";
      key?: string;
      backupPath?: string;
      version?: string;
    }>();
    if (!body.kind || !body.key || !body.backupPath || !body.version)
      throw new ApiError(400, "恢复参数不完整");
    try {
      return context.json(
        await restoreFeatureFile(
          await currentProject(),
          body.kind,
          body.key,
          body.backupPath,
          body.version,
        ),
      );
    } catch (error) {
      mapError(error);
    }
  });
  app.get("/api/feature/anime-seasons", async (context) =>
    context.json(await listAnimeSeasons(await currentProject())),
  );
  app.get("/api/feature/anime-season", async (context) => {
    const id = context.req.query("id");
    if (!id) throw new ApiError(400, "缺少季度路径");
    try {
      return context.json(await readAnimeSeason(await currentProject(), id));
    } catch (error) {
      mapError(error);
    }
  });
  app.put("/api/feature/anime-season", async (context) => {
    const body = await context.req.json<{ id?: string; content?: string; version?: string }>();
    if (!body.id || typeof body.content !== "string" || typeof body.version !== "string")
      throw new ApiError(400, "季度保存参数不完整");
    try {
      return context.json(
        await saveAnimeSeason(await currentProject(), body.id, body.content, body.version),
      );
    } catch (error) {
      mapError(error);
    }
  });
  app.delete("/api/feature/anime-season", async (context) => {
    const body = await context.req.json<{ id?: string; version?: string }>();
    if (!body.id || !body.version) throw new ApiError(400, "季度删除参数不完整");
    try {
      return context.json({
        trash: await deleteAnimeSeason(await currentProject(), body.id, body.version),
      });
    } catch (error) {
      mapError(error);
    }
  });
  app.get("/api/feature/albums", async (context) =>
    context.json(await listAlbums(await currentProject())),
  );
  app.put("/api/feature/album", async (context) => {
    const body = await context.req.json<{
      id?: string;
      info?: Record<string, unknown>;
      version?: string;
    }>();
    if (!body.id || !body.info || typeof body.version !== "string")
      throw new ApiError(400, "相册保存参数不完整");
    try {
      return context.json(
        await saveAlbum(await currentProject(), body.id, body.info, body.version),
      );
    } catch (error) {
      mapError(error);
    }
  });
  app.delete("/api/feature/album", async (context) => {
    const body = await context.req.json<{ id?: string; version?: string }>();
    if (!body.id || !body.version) throw new ApiError(400, "相册删除参数不完整");
    try {
      return context.json({
        trash: await deleteAlbum(await currentProject(), body.id, body.version),
      });
    } catch (error) {
      mapError(error);
    }
  });
}
