import type { AiChatMessage, AiWritingContext, AiWritingSettings } from "./ai-writing";
import { containsApiCredential } from "./api-credentials";
import { emptyDocument, patchSettings, personalValues } from "./panel-settings";
import type { FrontmatterEntry } from "./article";
import {
  parseAiFrontmatterChanges,
  parseAiFrontmatterEntries,
  type AiFrontmatterChange,
} from "./ai-frontmatter";

export interface WritingMessage extends AiChatMessage {
  id: string;
  model: string;
  provider: AiWritingSettings["provider"];
  intent: "read" | "chat" | "edit";
  failed?: boolean;
  truncated?: boolean;
  body?: string;
  frontmatter?: AiFrontmatterChange[];
}
export interface WritingSession {
  id: string;
  name: string;
  named: boolean;
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
  frontmatterEdit?: {
    before: FrontmatterEntry[];
    changes: AiFrontmatterChange[];
    messageId: string;
    applied: boolean;
    truncated: boolean;
  } | null;
}
export interface StoredConversations {
  schemaVersion: 1;
  activeId: string | null;
  sessions: Array<Omit<WritingSession, "read" | "loading" | "error">>;
}
export interface ConversationSnapshot {
  version: string | null;
  document: StoredConversations;
}
export const emptyConversations = (): StoredConversations => ({
  schemaVersion: 1,
  activeId: null,
  sessions: [],
});
export class ConversationValidationError extends Error {}
const fail = (): never => {
  throw new ConversationValidationError("会话内容无效或超过容量限制，未覆盖已保存会话。");
};
function object(value: unknown, fields: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !fields.includes(k))
  )
    return fail();
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number, nonempty = false): string {
  if (typeof value !== "string" || value.length > limit || (nonempty && !value.trim()))
    return fail();
  return value;
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean") return fail();
  return value;
}
function metadataEntries(input: unknown) {
  try {
    return parseAiFrontmatterEntries(input);
  } catch {
    return fail();
  }
}
function metadataChanges(input: unknown) {
  try {
    return parseAiFrontmatterChanges(input);
  } catch {
    return fail();
  }
}

/** Strict allowlist: request credentials and transient UI state never enter local history. */
export function parseStoredConversations(input: unknown): StoredConversations {
  const raw = JSON.stringify(input);
  if (!raw || raw.length > 4 * 1024 * 1024 || containsApiCredential(raw)) return fail();
  const value = object(input, ["schemaVersion", "activeId", "sessions"]);
  if (value.schemaVersion !== 1 || !Array.isArray(value.sessions) || value.sessions.length > 100)
    return fail();
  const sessions: StoredConversations["sessions"] = value.sessions.map((entry) => {
    const s = object(entry, [
      "id",
      "name",
      "named",
      "settings",
      "messages",
      "input",
      "edit",
      "frontmatterEdit",
    ]);
    const id = text(s.id, 128, true),
      name = text(s.name, 40, true);
    if (/[\r\n\x00-\x1f]/.test(name) || !Array.isArray(s.messages) || s.messages.length > 500)
      return fail();
    const settings = personalValues(
      patchSettings(emptyDocument("browser"), "browser", "ai", s.settings, "conversation"),
    ).ai;
    const messages: WritingMessage[] = s.messages.map((entry: unknown) => {
      const m = object(entry, [
        "id",
        "role",
        "content",
        "model",
        "provider",
        "intent",
        "failed",
        "truncated",
        "body",
        "frontmatter",
      ]);
      if (
        !["user", "assistant"].includes(String(m.role)) ||
        !["openai", "anthropic"].includes(String(m.provider)) ||
        !["chat", "edit"].includes(String(m.intent))
      )
        return fail();
      return {
        id: text(m.id, 128, true),
        role: m.role as WritingMessage["role"],
        content: text(m.content, 60000),
        model: text(m.model, 160),
        provider: m.provider as WritingMessage["provider"],
        intent: m.intent as WritingMessage["intent"],
        ...(m.failed === undefined ? {} : { failed: bool(m.failed) }),
        ...(m.truncated === undefined ? {} : { truncated: bool(m.truncated) }),
        ...(m.body === undefined ? {} : { body: text(m.body, 60000) }),
        ...(m.frontmatter === undefined ? {} : { frontmatter: metadataChanges(m.frontmatter) }),
      };
    });
    if (new Set(messages.map((m) => m.id)).size !== messages.length) return fail();
    let edit: WritingSession["edit"] = null;
    if (s.edit !== null) {
      const e = object(s.edit, ["context", "after", "messageId", "applied", "truncated"]);
      const c = object(e.context, ["body", "selection", "canInsert", "frontmatter"]);
      const messageId = text(e.messageId, 128, true);
      if (!messages.some((m) => m.id === messageId && m.role === "assistant")) return fail();
      edit = {
        context: {
          body: text(c.body, 60000),
          selection: text(c.selection, 20000),
          canInsert: bool(c.canInsert),
          ...(c.frontmatter === undefined ? {} : { frontmatter: metadataEntries(c.frontmatter) }),
        },
        after: text(e.after, 60000),
        messageId,
        applied: bool(e.applied),
        truncated: bool(e.truncated),
      };
    }
    let frontmatterEdit: WritingSession["frontmatterEdit"];
    if (s.frontmatterEdit !== undefined && s.frontmatterEdit !== null) {
      const e = object(s.frontmatterEdit, [
        "before",
        "changes",
        "messageId",
        "applied",
        "truncated",
      ]);
      const messageId = text(e.messageId, 128, true);
      if (!messages.some((m) => m.id === messageId && m.role === "assistant")) return fail();
      frontmatterEdit = {
        before: metadataEntries(e.before),
        changes: metadataChanges(e.changes),
        messageId,
        applied: bool(e.applied),
        truncated: bool(e.truncated),
      };
    }
    return {
      id,
      name,
      named: bool(s.named),
      settings,
      messages,
      input: text(s.input, 4000),
      edit,
      ...(frontmatterEdit ? { frontmatterEdit } : {}),
    };
  });
  if (new Set(sessions.map((s) => s.id)).size !== sessions.length) return fail();
  const activeId = value.activeId === null ? null : text(value.activeId, 128, true);
  if (
    (sessions.length && !sessions.some((s) => s.id === activeId)) ||
    (!sessions.length && activeId !== null)
  )
    return fail();
  return { schemaVersion: 1, activeId, sessions };
}
export function storeConversations(
  sessions: WritingSession[],
  activeId: string,
): StoredConversations {
  return parseStoredConversations({
    schemaVersion: 1,
    activeId,
    sessions: sessions.map(({ read: _read, loading: _loading, error: _error, ...session }) => ({
      ...session,
      input: _loading
        ? (session.messages.find((m) => m.id.endsWith(":pending"))?.content ?? session.input)
        : session.input,
      messages: session.messages
        .filter((m) => m.intent !== "read")
        .map((m) => (m.id.endsWith(":pending") ? { ...m, failed: true } : m)),
    })),
  });
}
export function restoreConversations(document: StoredConversations): WritingSession[] {
  return document.sessions.map((s) => ({ ...s, read: false, loading: false, error: "" }));
}
