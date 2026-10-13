import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { parseStoredConversations } from "../../shared/ai-conversations";
import { readConversations, saveConversations } from "../../lib/server/ai-conversations";
import { aiVault, type AiVault } from "../../lib/server/ai-vault";
import { containsSensitiveValue } from "../../lib/server/publish/credentials";
import { currentProject } from "../project";
import { readArticle, validateArticleId } from "../../lib/server/articles";
import { ApiError } from "../errors";

export function registerAiConversationRoutes(app: Hono, stateDir: string, vault?: AiVault) {
  app.use("/api/ai/conversations", async (c, next) => {
    c.header("cache-control", "no-store");
    await next();
  });
  const location = async (article: string | undefined) => {
    if (!article || article.length > 2048 || /[\x00-\x1f]/.test(article))
      throw new ApiError(400, "文章标识无效。");
    const report = await currentProject(stateDir);
    if (report.mode === "blocked") throw new ApiError(403, "当前项目不可用。");
    const id = validateArticleId(article);
    await readArticle(report, id);
    return { root: report.root, article: id, report };
  };
  app.get("/api/ai/conversations", async (c) => {
    const target = await location(c.req.query("article"));
    return c.json(await readConversations(stateDir, target.root, target.article));
  });
  app.put("/api/ai/conversations", bodyLimit({ maxSize: 16 * 1024 * 1024 }), async (c) => {
    const target = await location(c.req.query("article"));
    const body = await c.req.json().catch(() => {
      throw new ApiError(400, "会话保存参数不是有效 JSON。");
    });
    if (
      !body ||
      (body.version !== null && typeof body.version !== "string") ||
      Object.keys(body).some((k) => !["document", "version"].includes(k))
    )
      throw new ApiError(400, "会话保存参数无效。");
    const document = parseStoredConversations(body.document);
    if (containsSensitiveValue(JSON.stringify(document), await (vault ?? aiVault(stateDir)).keys()))
      throw new ApiError(400, "会话含有疑似 API Key，已阻止本地保存。");
    return c.json(
      await saveConversations(stateDir, target.root, target.article, document, body.version, () =>
        readArticle(target.report, target.article),
      ),
    );
  });
}
