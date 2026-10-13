import { AiWritingError } from "./ai-errors";
import type { AiEditTarget } from "../../shared/ai-writing";
import type { FrontmatterEntry } from "../../shared/article";
import {
  parseAiFrontmatterChanges,
  mergeAiFrontmatterChanges,
  changedFrontmatterPatches,
  type AiFrontmatterChange,
} from "../../shared/ai-frontmatter";
import { dataFromEntries } from "./article-format";
/** Text-only replies remain compatible with gateways that ignore the requested envelope. */
export function parseAiChatResult(
  result: string,
  currentBody: string,
  currentFrontmatter: FrontmatterEntry[] = [],
  target: AiEditTarget = "body",
  apiKey?: string,
): { text: string; body?: string; frontmatter?: AiFrontmatterChange[] } {
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
  const { reply, body, frontmatter } = value as {
    reply?: unknown;
    body?: unknown;
    frontmatter?: unknown;
  };
  const fragments = [
    reply,
    body,
    ...(Array.isArray(frontmatter)
      ? frontmatter.flatMap((e) => (e && typeof e === "object" ? [e.key, e.value] : []))
      : []),
  ];
  if (apiKey && fragments.some((v) => typeof v === "string" && v.includes(apiKey)))
    throw new AiWritingError(502, "AI 返回内容含有疑似 API Key，已阻止显示和写入。");
  if (
    typeof reply !== "string" ||
    !reply.trim() ||
    reply.length > 60000 ||
    (target !== "frontmatter" &&
      body !== null &&
      body !== undefined &&
      (typeof body !== "string" || !body.trim() || body.length > 60000))
  )
    throw new AiWritingError(502, "AI 回复缺少说明或完整正文，请重试；正文未修改。");
  const changed =
    target !== "frontmatter" &&
    typeof body === "string" &&
    body.replace(/\r\n?/g, "\n") !== currentBody.replace(/\r\n?/g, "\n");
  let changes: AiFrontmatterChange[] = [];
  if (target !== "body" && frontmatter !== undefined && frontmatter !== null) {
    try {
      const parsed = parseAiFrontmatterChanges(frontmatter);
      dataFromEntries(mergeAiFrontmatterChanges(currentFrontmatter, parsed));
      changes = changedFrontmatterPatches(currentFrontmatter, parsed);
    } catch (cause) {
      throw new AiWritingError(502, `AI Frontmatter 修改无效：${(cause as Error).message}`);
    }
  }
  return {
    text: reply,
    ...(changed ? { body: body as string } : {}),
    ...(changes.length ? { frontmatter: changes } : {}),
  };
}
