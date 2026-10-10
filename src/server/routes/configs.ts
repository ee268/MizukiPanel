import type { Hono } from "hono";
import {
  listConfigs,
  listConfigBackups,
  createConfigBackup,
  readConfig,
  readSiteAvatar,
  readSiteIdentity,
  restoreConfig,
  saveConfig,
} from "../../lib/server/configs";
import { readEditorFont, readEditorFontMode } from "../../lib/server/editor-fonts";
import { ApiError, mapError } from "../errors";
import { currentProject } from "../project";

export function registerConfigRoutes(app: Hono) {
  app.get("/api/editor-fonts", async (context) => {
    try {
      return context.json({ mode: await readEditorFontMode(await currentProject()) });
    } catch (error) {
      mapError(error);
    }
  });
  app.get("/api/editor-fonts/:name", async (context) => {
    const name = context.req.param("name");
    if (name !== "body" && name !== "cjk" && name !== "code") {
      throw new ApiError(404, "字体不存在");
    }
    try {
      const bytes = await readEditorFont(await currentProject(), name);
      if (!bytes) throw new ApiError(404, "字体尚未缓存");
      return context.body(Uint8Array.from(bytes), 200, {
        "content-type": "font/woff2",
        "cache-control": "private, max-age=300",
        "x-content-type-options": "nosniff",
      });
    } catch (error) {
      mapError(error);
    }
  });
  app.get("/api/site-identity", async (context) => {
    try {
      return context.json(await readSiteIdentity(await currentProject()));
    } catch (error) {
      mapError(error);
    }
  });
  app.get("/api/site-identity/avatar", async (context) => {
    try {
      const avatar = await readSiteAvatar(await currentProject());
      return context.body(Uint8Array.from(avatar.bytes), 200, {
        "content-type": avatar.type,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      });
    } catch (error) {
      mapError(error);
    }
  });
  app.get("/api/configs", async (context) =>
    context.json(await listConfigs(await currentProject())),
  );

  app.get("/api/config", async (context) => {
    const key = context.req.query("key");
    if (!key) throw new ApiError(400, "缺少配置名称");
    try {
      return context.json(await readConfig(await currentProject(), key));
    } catch (error) {
      mapError(error);
    }
  });

  app.put("/api/config", async (context) => {
    const body = await context.req.json<{
      key?: string;
      initializer?: string;
      version?: string;
      backupId?: string;
    }>();
    if (!body.key || typeof body.initializer !== "string" || typeof body.version !== "string")
      throw new ApiError(400, "配置保存参数不完整");
    if (body.backupId !== undefined && typeof body.backupId !== "string")
      throw new ApiError(400, "配置备份参数无效");
    try {
      return context.json(
        await saveConfig(
          await currentProject(),
          body.key,
          body.initializer,
          body.version,
          body.backupId,
        ),
      );
    } catch (error) {
      mapError(error);
    }
  });

  app.get("/api/config/backups", async (context) => {
    const key = context.req.query("key");
    if (!key) throw new ApiError(400, "缺少配置名称");
    try {
      return context.json(await listConfigBackups(await currentProject(), key));
    } catch (error) {
      mapError(error);
    }
  });
  app.post("/api/config/backup", async (context) => {
    const body = await context.req.json<{ key?: string; version?: string }>();
    if (!body.key || typeof body.version !== "string")
      throw new ApiError(400, "配置备份参数不完整");
    try {
      return context.json(await createConfigBackup(await currentProject(), body.key, body.version));
    } catch (error) {
      mapError(error);
    }
  });

  app.post("/api/config/restore", async (context) => {
    const body = await context.req.json<{ key?: string; backupPath?: string; version?: string }>();
    if (!body.key || !body.backupPath || typeof body.version !== "string")
      throw new ApiError(400, "配置恢复参数不完整");
    try {
      return context.json(
        await restoreConfig(await currentProject(), body.key, body.backupPath, body.version),
      );
    } catch (error) {
      mapError(error);
    }
  });
}
