import { useEffect, useRef, useState } from "react";
import { api, json } from "../api";
import { usePersonalSettings } from "../settings/PersonalSettingsProvider";
import { aiCredentials } from "./credentials";
import { useAiCredential, useAiVaultState } from "./useAiCredential";
import { sessionLifecycle } from "../auth/session-lifecycle";
import { useSessionRecovery } from "../auth/useSessionRecovery";
import { containsApiCredential } from "../../shared/api-credentials";
import { storeConversations, restoreConversations } from "../../shared/ai-conversations";
import { useConversationPersistence } from "./useConversationPersistence";
import { requestConversationTurn } from "./conversation-turn";
import type { FrontmatterEntry } from "../../shared/article";
import { parseAiFrontmatterChanges, type AiFrontmatterChange } from "../../shared/ai-frontmatter";
import type { AiWritingContext, AiWritingResult, AiWritingSettings } from "../../shared/ai-writing";
import { conversationHistory, createWritingSession, type WritingSession } from "./conversations";
export function useAiConversations({
  getContext,
  articleId,
  title,
  disabled,
  onApply,
  onApplyFrontmatter,
}: {
  getContext: () => AiWritingContext;
  articleId: string;
  title: string;
  disabled: boolean;
  onApply: (text: string, context: AiWritingContext) => void;
  onApplyFrontmatter?: (changes: AiFrontmatterChange[], before: FrontmatterEntry[]) => void;
}) {
  const preferences = usePersonalSettings();
  useAiVaultState();
  const [sessions, setSessions] = useState(() => [createWritingSession(preferences.saved.ai, 1)]);
  const [activeId, setActiveId] = useState(sessions[0].id);
  const current = useRef(sessions),
    callbacks = useRef({ getContext, title, disabled, onApply, onApplyFrontmatter });
  callbacks.current = { getContext, title, disabled, onApply, onApplyFrontmatter };
  const requests = useRef(new Map<string, AbortController>()),
    count = useRef(1);
  const activeRef = useRef(activeId);
  const [stage, setStage] = useState<Record<string, string>>({});
  const persistence = useConversationPersistence(articleId, (document) => {
    const restored = restoreConversations(document);
    current.current = restored.length ? restored : [createWritingSession(preferences.saved.ai, 1)];
    count.current = current.current.length;
    activeRef.current = document.activeId ?? current.current[0].id;
    setSessions(current.current);
    setActiveId(activeRef.current);
  });
  function persist() {
    if (!persistence.ready) return;
    try {
      const document = storeConversations(current.current, activeRef.current);
      const raw = JSON.stringify(document);
      if (
        [aiCredentials.get("openai"), aiCredentials.get("anthropic")].some(
          (key) => key && raw.includes(key),
        )
      )
        throw new Error("会话含有 API Key，未保存。");
      persistence.save(document);
    } catch (cause) {
      persistence.report((cause as Error).message);
    }
  }
  const openaiKey = useAiCredential("openai"),
    anthropicKey = useAiCredential("anthropic");
  function update(id: string, change: (session: WritingSession) => WritingSession) {
    current.current = current.current.map((session) =>
      session.id === id ? change(session) : session,
    );
    setSessions(current.current);
    persist();
  }
  function cancel(id: string) {
    const abort = requests.current.get(id);
    abort?.abort();
    requests.current.delete(id);
    update(id, (session) => ({
      ...session,
      loading: false,
      input:
        session.messages.find((message) => message.id === `${id}:pending`)?.content ??
        session.input,
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
  useSessionRecovery({
    label: "AI 会话",
    prepare: () => {
      for (const id of [...requests.current.keys()]) cancel(id);
    },
    save: () => persistence.flush(),
    snapshot: () => {
      if (!persistence.dirty()) return null;
      try {
        const document = storeConversations(current.current, activeRef.current);
        if (
          [aiCredentials.get("openai"), aiCredentials.get("anthropic")].some(
            (key) => key && JSON.stringify(document).includes(key),
          )
        )
          return null;
        return document;
      } catch {
        return null;
      }
    },
  });
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
            frontmatterEdit: null,
            read: false,
            loading: false,
            error: "",
          }));
          setSessions(current.current);
        }
      }),
    [],
  );
  async function run(id: string, instruction: string): Promise<boolean> {
    const session = current.current.find((item) => item.id === id);
    if (!session || !persistence.ready || requests.current.has(id) || callbacks.current.disabled)
      return false;
    const key = aiCredentials.get(session.settings.provider),
      model =
        session.settings.provider === "openai"
          ? session.settings.openaiModel
          : session.settings.anthropicModel;
    if (!aiCredentials.available(session.settings.provider) || !model.trim()) {
      update(id, (item) => ({
        ...item,
        error: "请在“设置 → 文章编辑 → AI 辅助写作”填写模型 ID 和 API Key。",
      }));
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
    const abort = new AbortController(),
      pendingId = `${id}:pending`;
    requests.current.set(id, abort);
    setStage((stages) => ({ ...stages, [id]: "正在处理请求" }));
    update(id, (item) => ({
      ...item,
      loading: true,
      error: "",
      input: "",
      messages: [
        ...item.messages,
        {
          id: pendingId,
          role: "user",
          content: instruction,
          intent: "chat",
          model,
          provider: session.settings.provider,
        },
      ],
    }));
    try {
      const { result, context } = await requestConversationTurn({
        request: {
          settings: { ...session.settings, openaiModels: [], anthropicModels: [] },
          apiKey: key,
          useSavedKey: !key && aiCredentials.saved(session.settings.provider),
          action: "custom",
          instruction,
          title: callbacks.current.title,
          context: "",
          selection: "",
          conversation: {
            intent: "route",
            messages: conversationHistory(session.messages),
            generateTitle: !session.named,
          },
        },
        send: (request) =>
          api<AiWritingResult>("/api/article/ai-writing", {
            ...json("POST", request),
            signal: abort.signal,
          }),
        signal: abort.signal,
        getContext: () => callbacks.current.getContext(),
        routed: (result) => {
          if (result.sessionTitle)
            update(id, (item) =>
              item.named ? item : { ...item, name: result.sessionTitle!, named: true },
            );
        },
        reading: (editing) =>
          setStage((stages) => ({
            ...stages,
            [id]: editing ? "正在读取正文并生成修改" : "正在读取正文并回答问题",
          })),
      });
      if (abort.signal.aborted || requests.current.get(id) !== abort) return false;
      const messageId = crypto.randomUUID();
      const after = context ? result.body : undefined;
      const changed =
        context &&
        typeof after === "string" &&
        after.replace(/\r\n?/g, "\n") !== context.body.replace(/\r\n?/g, "\n");
      const metadata =
        context?.frontmatter && result.frontmatter?.length ? result.frontmatter : undefined;
      update(id, (item) => ({
        ...item,
        read: Boolean(context),
        messages: [
          ...item.messages.map((message) =>
            message.id === pendingId ? { ...message, id: crypto.randomUUID() } : message,
          ),
          {
            id: messageId,
            role: "assistant",
            content: result.text,
            intent: "chat",
            model,
            provider: session.settings.provider,
            truncated: result.truncated,
            ...(changed ? { body: after } : {}),
            ...(metadata ? { frontmatter: metadata } : {}),
          },
        ],
        edit: changed
          ? {
              context: context!,
              after: after!,
              messageId,
              applied: false,
              truncated: result.truncated,
            }
          : item.edit,
        frontmatterEdit: metadata
          ? {
              before: context!.frontmatter!,
              changes: metadata,
              messageId,
              applied: false,
              truncated: result.truncated,
            }
          : item.frontmatterEdit,
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
          input: instruction,
        }));
      return false;
    } finally {
      if (requests.current.get(id) === abort) {
        requests.current.delete(id);
        update(id, (item) => ({ ...item, loading: false }));
      }
    }
  }
  function create() {
    const session = createWritingSession(
      current.current.find((item) => item.id === activeId)?.settings ?? preferences.saved.ai,
      ++count.current,
    );
    current.current = [...current.current, session];
    setSessions(current.current);
    setActiveId(session.id);
    activeRef.current = session.id;
    persist();
  }
  function remove(id: string) {
    cancel(id);
    const remaining = current.current.filter((item) => item.id !== id);
    current.current = remaining;
    setSessions(remaining);
    if (activeRef.current === id && remaining.length) {
      activeRef.current = remaining[0].id;
      setActiveId(activeRef.current);
    }
    if (!remaining.length) create();
    else persist();
  }
  async function send(_intent: "chat" | "edit") {
    const session = current.current.find((item) => item.id === activeId);
    if (!session?.input.trim()) return;
    await run(activeId, session.input);
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
  const canApplyFrontmatter =
    Boolean(active.frontmatterEdit?.changes.length && onApplyFrontmatter) &&
    !containsApiCredential(JSON.stringify(active.frontmatterEdit?.changes ?? [])) &&
    ![openaiKey, anthropicKey].some(
      (key) => key && JSON.stringify(active.frontmatterEdit?.changes ?? []).includes(key),
    );
  function applyFrontmatter() {
    const edit = active.frontmatterEdit;
    if (
      !edit ||
      !canApplyFrontmatter ||
      edit.truncated ||
      edit.applied ||
      callbacks.current.disabled
    )
      return;
    try {
      callbacks.current.onApplyFrontmatter?.(parseAiFrontmatterChanges(edit.changes), edit.before);
      update(active.id, (item) => ({
        ...item,
        frontmatterEdit: item.frontmatterEdit ? { ...item.frontmatterEdit, applied: true } : null,
        error: "",
      }));
    } catch (cause) {
      update(active.id, (item) => ({ ...item, error: (cause as Error).message }));
    }
  }
  return {
    sessions,
    active,
    activeId,
    setActiveId: (id: string) => {
      if (current.current.some((s) => s.id === id)) {
        activeRef.current = id;
        setActiveId(id);
        persist();
      }
    },
    rename: (id: string, name: string) => {
      const trimmed = name.trim();
      if (
        !trimmed ||
        trimmed.length > 40 ||
        /[\x00-\x1f]/.test(trimmed) ||
        containsApiCredential(trimmed) ||
        [openaiKey, anthropicKey].some((k) => k && trimmed.includes(k))
      )
        return false;
      update(id, (item) => ({ ...item, name: trimmed, named: true }));
      return true;
    },
    persistence,
    stage: stage[activeId] ?? "正在处理请求",
    create,
    remove,
    cancel,
    send,
    canApply,
    apply,
    canApplyFrontmatter,
    applyFrontmatter,
    setInput: (input: string) => update(active.id, (item) => ({ ...item, input })),
    setSettings: (fields: Partial<AiWritingSettings>) =>
      update(active.id, (item) => ({ ...item, settings: { ...item.settings, ...fields } })),
    setEdit: (after: string) =>
      update(active.id, (item) => ({
        ...item,
        edit: item.edit ? { ...item.edit, after } : null,
        messages: item.messages.map((message) =>
          message.id === item.edit?.messageId
            ? message.body !== undefined
              ? { ...message, body: after }
              : { ...message, content: after }
            : message,
        ),
      })),
  };
}
