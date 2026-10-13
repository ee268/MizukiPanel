import { AiWritingError } from "./ai-errors";

/** Reading cannot modify the article, so legacy JSON formatting must not block a reply. */
export function parseAiReadResult(result: string): { text: string } {
  const raw = result.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1");
  if (raw.startsWith("{")) {
    try {
      const value = JSON.parse(raw);
      if (typeof value?.reply === "string" && value.reply.trim()) return { text: value.reply };
    } catch {
      // Recover a complete reply string even if a trailing legacy body field is malformed.
      const reply = raw.match(/"reply"\s*:\s*("(?:\\.|[^"\\])*")/);
      if (reply)
        try {
          const text = JSON.parse(reply[1]);
          if (text.trim()) return { text };
        } catch {
          /* use read-only text */
        }
      const partial = raw.match(/^\{\s*"reply"\s*:\s*"([\s\S]*)$/)?.[1];
      if (partial)
        try {
          const fragment = partial
            .replace(/\\u[0-9a-fA-F]{0,3}$|\\$/g, "")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t");
          const text = JSON.parse(`"${fragment}"`);
          if (text.trim()) return { text };
        } catch {
          /* preserve unstructured read-only text */
        }
    }
  }
  return { text: result };
}
export function parseAiSessionTitle(result: string): { text: string; sessionTitle: string } {
  const raw = result.trim().replace(/^```(?:\w+)?\s*\n([\s\S]*?)\n```$/, "$1");
  let title = raw;
  if (raw.startsWith("{")) {
    try {
      title = JSON.parse(raw).title;
    } catch {
      throw new AiWritingError(502, "会话标题格式无效。");
    }
  }
  if (typeof title !== "string") throw new AiWritingError(502, "会话标题格式无效。");
  title = title
    .split(/\r?\n/)[0]
    .replace(/^(?:会话标题|标题|Title)\s*[:：]\s*/i, "")
    .replace(/^["“'「]|["”'」]$/g, "")
    .trim();
  if (!title || /[\x00-\x1f]/.test(title)) throw new AiWritingError(502, "会话标题为空或无效。");
  return { text: "", sessionTitle: Array.from(title).slice(0, 40).join("") };
}
