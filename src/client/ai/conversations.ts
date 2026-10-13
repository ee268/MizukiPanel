import type { AiChatMessage, AiWritingSettings } from "../../shared/ai-writing";
import type { WritingMessage, WritingSession } from "../../shared/ai-conversations";
export type { WritingMessage, WritingSession } from "../../shared/ai-conversations";
export function createWritingSession(settings: AiWritingSettings, index: number): WritingSession {
  return {
    id: crypto.randomUUID(),
    name: `会话 ${index}`,
    named: false,
    settings: { ...settings },
    messages: [],
    input: "",
    read: false,
    loading: false,
    error: "",
    edit: null,
  };
}
/** Send recent complete messages within the API bound; sessions remain intact on screen. */
export function conversationHistory(messages: WritingMessage[]): AiChatMessage[] {
  const result: AiChatMessage[] = [];
  let length = 0;
  for (const message of messages
    .filter((item) => !item.failed && item.intent !== "read")
    .slice(-20)
    .reverse()) {
    const content = message.content;
    if (length + content.length > 60000) break;
    result.unshift({ role: message.role, content });
    length += content.length;
  }
  while (result[0]?.role === "assistant") result.shift();
  return result;
}
