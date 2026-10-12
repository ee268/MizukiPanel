import { useEffect, useRef, useState } from "react";
import { api, json } from "../api";
import { usePersonalSettings } from "../settings/PersonalSettingsProvider";
import { aiCredentials } from "./credentials";
import { useAiCredential } from "./useAiCredential";
import { sessionLifecycle } from "../auth/session-lifecycle";
import { containsApiCredential } from "../../shared/api-credentials";
import type { AiWritingContext, AiWritingResult, AiWritingSettings } from "../../shared/ai-writing";
import {
  conversationHistory,
  createWritingSession,
  type WritingSession,
  type WritingMessage,
} from "./conversations";
export function useAiConversations({
  getContext,
  initialContext,
  title,
  disabled,
  onApply,
}: {
  getContext: () => AiWritingContext;
  initialContext: AiWritingContext;
  title: string;
  disabled: boolean;
  onApply: (text: string, context: AiWritingContext) => void;
}) {
  const preferences = usePersonalSettings();
  const [sessions, setSessions] = useState(() => [createWritingSession(preferences.saved.ai, 1)]);
  const [activeId, setActiveId] = useState(sessions[0].id);
  const current = useRef(sessions),
    callbacks = useRef({ getContext, title, disabled, onApply });
  callbacks.current = { getContext, title, disabled, onApply };
  const requests = useRef(new Map<string, AbortController>()),
    count = useRef(1);
  const openaiKey = useAiCredential("openai"),
    anthropicKey = useAiCredential("anthropic");
  function update(id: string, change: (session: WritingSession) => WritingSession) {
    current.current = current.current.map((session) =>
      session.id === id ? change(session) : session,
    );
    setSessions(current.current);
  }
  function cancel(id: string) {
    const abort = requests.current.get(id);
    abort?.abort();
    requests.current.delete(id);
    update(id, (session) => ({
      ...session,
      loading: false,
      input:
        session.messages.find(
          (message) => message.id === `${id}:pending` && message.intent !== "read",
        )?.content ?? session.input,
      messages: session.messages.map((message) =>
        message.id === `${id}:pending`
          ? { ...message, id: crypto.randomUUID(), failed: true }
          : message,
      ),
    }));
  }
  function abortAll() {
    for (const abort of requests.current.values()) abort.abort();
    requests.current.clear();
  }
  useEffect(() => () => abortAll(), []);
  useEffect(
    () =>
      sessionLifecycle.subscribe(() => {
        if (sessionLifecycle.getState().exit) {
          abortAll();
          current.current = current.current.map((session) => ({
            ...session,
            messages: [],
            input: "",
            edit: null,
            read: false,
            loading: false,
            error: "",
          }));
          setSessions(current.current);
        }
      }),
    [],
  );
  async function run(
    id: string,
    intent: WritingMessage["intent"],
    instruction: string,
  ): Promise<boolean> {
    const session = current.current.find((item) => item.id === id);
    if (!session || requests.current.has(id) || callbacks.current.disabled) return false;
    const key = aiCredentials.get(session.settings.provider),
      model =
        session.settings.provider === "openai"
          ? session.settings.openaiModel
          : session.settings.anthropicModel;
    if (!key || !model.trim()) {
      update(id, (item) => ({ ...item, error: "请在连接设置中填写模型 ID 和本次会话 API Key。" }));
      return false;
    }
    if (
      !instruction.trim() ||
      instruction.length > 4000 ||
      containsApiCredential(instruction) ||
      [aiCredentials.get("openai"), aiCredentials.get("anthropic")].some(
        (value) => value && instruction.includes(value),
      )
    ) {
      update(id, (item) => ({
        ...item,
        error: "请填写最多 4000 字符的要求，不在对话中填写 API Key。",
      }));
      return false;
    }
    let context: AiWritingContext;
    try {
      context = callbacks.current.getContext();
      if (context.body === initialContext.body)
        context = { ...context, selection: initialContext.selection };
    } catch (cause) {
      update(id, (item) => ({
        ...item,
        error: cause instanceof Error ? cause.message : "无法读取文章。",
      }));
      return false;
    }
    const abort = new AbortController(),
      pendingId = `${id}:pending`;
    requests.current.set(id, abort);
    update(id, (item) => ({
      ...item,
      loading: true,
      error: "",
      input: intent === "read" ? item.input : "",
      messages: [
        ...item.messages,
        {
          id: pendingId,
          role: "user",
          content: instruction,
          intent,
          model,
          provider: session.settings.provider,
        },
      ],
    }));
    try {
      const result = await api<AiWritingResult>("/api/article/ai-writing", {
        ...json("POST", {
          settings: { ...session.settings, openaiModels: [], anthropicModels: [] },
          apiKey: key,
          action: "custom",
          instruction,
          title: callbacks.current.title,
          context: context.body,
          selection: context.selection,
          conversation: { intent, messages: conversationHistory(session.messages) },
        }),
        signal: abort.signal,
      });
      if (abort.signal.aborted || requests.current.get(id) !== abort) return false;
      const messageId = crypto.randomUUID();
      update(id, (item) => ({
        ...item,
        read: true,
        messages: [
          ...item.messages.map((message) =>
            message.id === pendingId ? { ...message, id: crypto.randomUUID() } : message,
          ),
          {
            id: messageId,
            role: "assistant",
            content: result.text,
            intent,
            model,
            provider: session.settings.provider,
            truncated: result.truncated,
          },
        ],
        edit:
          intent === "edit"
            ? {
                context,
                after: result.text,
                messageId,
                applied: false,
                truncated: result.truncated,
              }
            : item.edit,
      }));
      return true;
    } catch (cause) {
      if (!abort.signal.aborted)
        update(id, (item) => ({
          ...item,
          error: cause instanceof Error ? cause.message : "AI 请求失败。",
          messages: item.messages.map((message) =>
            message.id === pendingId
              ? { ...message, id: crypto.randomUUID(), failed: true }
              : message,
          ),
          input: intent === "read" ? item.input : instruction,
        }));
      return false;
    } finally {
      if (requests.current.get(id) === abort) {
        requests.current.delete(id);
        update(id, (item) => ({ ...item, loading: false }));
      }
    }
  }
  const readInstruction = "请先阅读当前文章，概括主题和结构，然后等待我的要求。";
  function autoRead(id: string) {
    const session = current.current.find((item) => item.id === id);
    if (
      session &&
      aiCredentials.get(session.settings.provider) &&
      (session.settings.provider === "openai"
        ? session.settings.openaiModel
        : session.settings.anthropicModel
      ).trim()
    )
      void run(id, "read", readInstruction);
  }
  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) autoRead(current.current[0].id);
    });
    return () => {
      disposed = true;
    };
  }, []);
  function create() {
    const session = createWritingSession(
      current.current.find((item) => item.id === activeId)?.settings ?? preferences.saved.ai,
      ++count.current,
    );
    current.current = [...current.current, session];
    setSessions(current.current);
    setActiveId(session.id);
    autoRead(session.id);
  }
  function remove(id: string) {
    cancel(id);
    const remaining = current.current.filter((item) => item.id !== id);
    current.current = remaining;
    setSessions(remaining);
    if (activeId === id && remaining.length) setActiveId(remaining[0].id);
    if (!remaining.length) create();
  }
  async function send(intent: "chat" | "edit") {
    const session = current.current.find((item) => item.id === activeId);
    if (!session?.input.trim()) return;
    if (!session.read && !(await run(activeId, "read", readInstruction))) return;
    await run(activeId, intent, session.input);
  }
  const active = sessions.find((session) => session.id === activeId) ?? sessions[0];
  const canApply =
    Boolean(active.edit?.after.trim()) &&
    !containsApiCredential(active.edit?.after ?? "") &&
    ![openaiKey, anthropicKey].some((key) => key && active.edit?.after.includes(key));
  function apply() {
    if (!active.edit || !canApply || active.edit.truncated) return;
    try {
      callbacks.current.onApply(active.edit.after, active.edit.context);
      update(active.id, (item) => ({
        ...item,
        edit: item.edit ? { ...item.edit, applied: true } : null,
        error: "",
      }));
    } catch (cause) {
      update(active.id, (item) => ({
        ...item,
        error: cause instanceof Error ? cause.message : "无法采用建议。",
      }));
    }
  }
  return {
    sessions,
    active,
    activeId,
    setActiveId,
    create,
    remove,
    cancel,
    send,
    read: () => run(active.id, "read", readInstruction),
    canApply,
    apply,
    setInput: (input: string) => update(active.id, (item) => ({ ...item, input })),
    setSettings: (fields: Partial<AiWritingSettings>) =>
      update(active.id, (item) => ({ ...item, settings: { ...item.settings, ...fields } })),
    setEdit: (after: string) =>
      update(active.id, (item) => ({
        ...item,
        edit: item.edit ? { ...item.edit, after } : null,
        messages: item.messages.map((message) =>
          message.id === item.edit?.messageId ? { ...message, content: after } : message,
        ),
      })),
  };
}
