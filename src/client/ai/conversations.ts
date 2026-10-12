import type { AiChatMessage, AiWritingContext, AiWritingSettings } from "../../shared/ai-writing";
export interface WritingMessage extends AiChatMessage {
  id: string;
  model: string;
  provider: AiWritingSettings["provider"];
  intent: "read" | "chat" | "edit";
  failed?: boolean;
  truncated?: boolean;
}
export interface WritingSession {
  id: string;
  name: string;
  settings: AiWritingSettings;
  messages: WritingMessage[];
  input: string;
  read: boolean;
  loading: boolean;
  error: string;
  edit: {
    context: AiWritingContext;
    after: string;
    messageId: string;
    applied: boolean;
    truncated: boolean;
  } | null;
}
export function createWritingSession(settings: AiWritingSettings, index: number): WritingSession {
  return {
    id: crypto.randomUUID(),
    name: `会话 ${index}`,
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
    .filter((item) => !item.failed)
    .slice(-20)
    .reverse()) {
    if (length + message.content.length > 60000) break;
    result.unshift({ role: message.role, content: message.content });
    length += message.content.length;
  }
  while (result[0]?.role === "assistant") result.shift();
  return result;
}
