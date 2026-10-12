import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { AiWritingError, generateAiWriting } from "../../lib/server/ai-writing";
import { currentProject } from "../project";
import { listAiModels } from "../../lib/server/ai-models";

export function registerAiWritingRoutes(app: Hono) {
  app.post("/api/article/ai-writing", bodyLimit({ maxSize: 512 * 1024 }), async (context) => {
    try {
      const report = await currentProject();
      if (report.readOnly || report.mode === "blocked")
        return context.json({ message: "当前工作区不可编辑。" }, 403, {
          "cache-control": "no-store",
        });
      const input: unknown = await context.req.json();
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
        await listAiModels(await context.req.json(), context.req.raw.signal),
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
