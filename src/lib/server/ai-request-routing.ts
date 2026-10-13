import { AiWritingError } from "./ai-errors";
import type { AiWritingResult } from "../../shared/ai-writing";

export function parseAiRoutingResult(
  raw: string,
  generateTitle: boolean,
): Omit<AiWritingResult, "truncated"> {
  let value: {
    needsArticle?: unknown;
    needsEdit?: unknown;
    reply?: unknown;
    title?: unknown;
    editTarget?: unknown;
  };
  try {
    value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1"));
  } catch {
    throw new AiWritingError(502, "AI 未返回有效的请求判断，请重试；尚未读取正文。");
  }
  if (
    !value ||
    typeof value.needsArticle !== "boolean" ||
    typeof value.needsEdit !== "boolean" ||
    (value.needsEdit && !value.needsArticle) ||
    (value.editTarget !== undefined &&
      !["body", "frontmatter", "both"].includes(String(value.editTarget))) ||
    typeof value.reply !== "string" ||
    value.reply.length > 60000 ||
    (!value.needsArticle && !value.reply.trim()) ||
    (generateTitle &&
      (typeof value.title !== "string" ||
        !value.title.trim() ||
        value.title.trim().length > 40 ||
        /[\x00-\x1f]/.test(value.title)))
  )
    throw new AiWritingError(502, "AI 请求判断或会话标题无效，请重试；尚未读取正文。");
  return {
    text: value.needsArticle ? "" : value.reply,
    needsArticle: value.needsArticle,
    needsEdit: value.needsEdit,
    ...(value.needsEdit && value.editTarget
      ? { editTarget: value.editTarget as "body" | "frontmatter" | "both" }
      : {}),
    ...(generateTitle ? { sessionTitle: (value.title as string).trim() } : {}),
  };
}
