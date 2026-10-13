import { useEffect, useRef, useState } from "react";
import { api, json } from "../api";
import type { ConversationSnapshot, StoredConversations } from "../../shared/ai-conversations";
import { ConversationSaveQueue } from "./conversation-save-queue";

export function useConversationPersistence(
  articleId: string,
  restore: (document: StoredConversations) => void,
) {
  const [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const store = useRef({ ready: false, alive: false, loadSequence: 0 });
  const url = `/api/ai/conversations?article=${encodeURIComponent(articleId)}`;
  const queue = useRef<ConversationSaveQueue | null>(null);
  if (!queue.current)
    queue.current = new ConversationSaveQueue((document, version) =>
      api<ConversationSnapshot>(url, json("PUT", { document, version })),
    );
  async function load() {
    const sequence = ++store.current.loadSequence;
    try {
      const snapshot = await api<ConversationSnapshot>(url);
      if (!store.current.alive || sequence !== store.current.loadSequence) return;
      queue.current!.version = snapshot.version;
      restoreRef.current(snapshot.document);
      store.current.ready = true;
      setReady(true);
      setError("");
    } catch (cause) {
      if (store.current.alive && sequence === store.current.loadSequence)
        setError(`恢复会话失败：${(cause as Error).message}`);
    }
  }
  useEffect(() => {
    store.current.alive = true;
    void load();
    return () => {
      store.current.alive = false;
      store.current.loadSequence++;
    };
  }, []);
  async function drain() {
    const s = store.current;
    if (!s.ready) return;
    if (s.alive) setSaving(true);
    try {
      await queue.current!.flush();
      if (s.alive) setError("");
    } catch (cause) {
      if (s.alive) setError(`会话尚未保存：${(cause as Error).message}`);
      throw cause;
    } finally {
      if (s.alive) setSaving(false);
    }
  }
  return {
    ready,
    saving,
    error,
    save: (document: StoredConversations) => {
      queue.current!.enqueue(document);
      void drain().catch(() => {});
    },
    report: setError,
    flush: drain,
    dirty: () => queue.current!.dirty,
    retry: () => (store.current.ready ? void drain().catch(() => {}) : void load()),
  };
}
