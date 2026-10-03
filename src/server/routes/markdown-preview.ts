import type { Hono } from "hono";
import { renderMarkdownDraft } from "../../lib/server/markdown-preview";
import { ApiError, mapError } from "../errors";
import { currentProject } from "../project";

export function registerMarkdownPreviewRoutes(app: Hono) {
  app.post("/api/article/render-draft", async (context) => {
    try {
      const body = await context.req.json<{ id?: string; body?: string }>();
      if (!body || typeof body.id !== "string" || typeof body.body !== "string") {
        throw new ApiError(400, "草稿预览参数无效");
      }
      const rendered = await renderMarkdownDraft(await currentProject(), body.id, body.body);
      return context.json(rendered, 200, { "cache-control": "no-store" });
    } catch (error) {
      mapError(error);
    }
  });
}
