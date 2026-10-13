import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { aiVault, AiVault, AiVaultError } from "../../lib/server/ai-vault";

export function registerAiVaultRoutes(app: Hono, vault?: AiVault) {
  const store = () => vault ?? aiVault();
  app.post("/api/ai/credentials/backup", async (context) => {
    try {
      await store().backup();
      return context.json({ message: "AI 加密备份已创建，可在备份管理中恢复。" }, 200, {
        "cache-control": "no-store",
      });
    } catch (cause) {
      const error =
        cause instanceof AiVaultError ? cause : new AiVaultError("无法创建 AI 加密备份。");
      return context.json({ message: error.message }, error.status, {
        "cache-control": "no-store",
      });
    }
  });
  app.get("/api/ai/credentials", async (context) => {
    try {
      return context.json(await store().status(), 200, { "cache-control": "no-store" });
    } catch (cause) {
      const error =
        cause instanceof AiVaultError ? cause : new AiVaultError("无法读取 AI 加密配置。");
      return context.json({ message: error.message }, error.status, {
        "cache-control": "no-store",
      });
    }
  });
  app.put("/api/ai/credentials", bodyLimit({ maxSize: 256 * 1024 }), async (context) => {
    try {
      return context.json(await store().save(await context.req.json()), 200, {
        "cache-control": "no-store",
      });
    } catch (cause) {
      const error =
        cause instanceof AiVaultError
          ? cause
          : new AiVaultError("AI 加密配置保存失败。未保存明文密钥。");
      return context.json({ message: error.message }, error.status, {
        "cache-control": "no-store",
      });
    }
  });
}
