import { AiWritingError } from "./ai-errors";
/** Text-only replies remain compatible with gateways that ignore the requested envelope. */
export function parseAiChatResult(
  result: string,
  currentBody: string,
): { text: string; body?: string } {
  const raw = result.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1");
  if (!raw.startsWith("{")) return { text: result };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new AiWritingError(502, "AI 回复格式不完整，请重试；正文未修改。");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AiWritingError(502, "AI 回复格式无效，请重试；正文未修改。");
  const { reply, body } = value as { reply?: unknown; body?: unknown };
  if (
    typeof reply !== "string" ||
    !reply.trim() ||
    reply.length > 60000 ||
    (body !== null &&
      body !== undefined &&
      (typeof body !== "string" || !body.trim() || body.length > 60000))
  )
    throw new AiWritingError(502, "AI 回复缺少说明或完整正文，请重试；正文未修改。");
  const changed =
    typeof body === "string" &&
    body.replace(/\r\n?/g, "\n") !== currentBody.replace(/\r\n?/g, "\n");
  return { text: reply, ...(changed ? { body: body as string } : {}) };
}
