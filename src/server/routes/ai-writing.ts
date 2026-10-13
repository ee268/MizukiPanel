import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { AiWritingError, generateAiWriting } from "../../lib/server/ai-writing";
import { currentProject } from "../project";
import { listAiModels } from "../../lib/server/ai-models";
import { aiVault, AiVaultError, type AiVault } from "../../lib/server/ai-vault";

async function withSavedKey(input: unknown, vault?: AiVault) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const value = input as {
    settings?: { provider?: unknown };
    apiKey?: unknown;
    useSavedKey?: unknown;
  };
  const provider = value.settings?.provider;
  if (
    value.useSavedKey !== true ||
    value.apiKey ||
    (provider !== "openai" && provider !== "anthropic")
  )
    return input;
  try {
    return { ...value, apiKey: await (vault ?? aiVault()).key(provider) };
  } catch (cause) {
    throw new AiWritingError(
      503,
      cause instanceof AiVaultError ? cause.message : "无法读取已保存密钥。",
    );
  }
}

export function registerAiWritingRoutes(app: Hono, vault?: AiVault) {
  app.post("/api/article/ai-writing", bodyLimit({ maxSize: 1024 * 1024 }), async (context) => {
    try {
      const report = await currentProject();
      if (report.readOnly || report.mode === "blocked")
        return context.json({ message: "当前工作区不可编辑。" }, 403, {
          "cache-control": "no-store",
        });
      const input = await withSavedKey(await context.req.json(), vault);
      return context.json(await generateAiWriting(input, context.req.raw.signal), 200, {
        "cache-control": "no-store",
      });
    } catch (cause) {
      const error =
        cause instanceof AiWritingError
          ? cause
          : new AiWritingError(400, "AI 写作请求无效，请检查项目连接和输入。");
      return context.json({ message: error.message }, error.status, {
        "cache-control": "no-store",
      });
    }
  });
  app.post("/api/ai/models", bodyLimit({ maxSize: 32 * 1024 }), async (context) => {
    try {
      return context.json(
        await listAiModels(
          await withSavedKey(await context.req.json(), vault),
          context.req.raw.signal,
        ),
        200,
        { "cache-control": "no-store" },
      );
    } catch (cause) {
      const error =
        cause instanceof AiWritingError ? cause : new AiWritingError(400, "模型查询请求无效。");
      return context.json({ message: error.message }, error.status, {
        "cache-control": "no-store",
      });
    }
  });
}
