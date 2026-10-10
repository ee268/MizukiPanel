import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArticleRecord } from "../types";
import { usePersonalSettings } from "../settings/PersonalSettingsProvider";
import type { FrontmatterRow } from "./types";
import { useSessionRecovery } from "../auth/useSessionRecovery";
import {
  draftError,
  draftKey,
  draftTarget,
  DraftWriter,
  IndexedDraftStore,
  notifyDraft,
  type DraftEvent,
  type LocalDraft,
} from "./local-drafts";

export function useArticleDrafts(input: {
  projectKey: string;
  article: ArticleRecord | null;
  source: string;
  frontmatter: FrontmatterRow[];
  dirty: boolean;
  busy: boolean;
  readOnly: boolean;
}) {
  const { saved } = usePersonalSettings();
  const target =
    input.article && input.projectKey ? draftTarget(input.projectKey, input.article.id) : "";
  const sessionId = useMemo(() => crypto.randomUUID(), [target]);
  const [entries, setEntries] = useState<LocalDraft[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const mounted = useRef(true);
  const latest = useRef(input);
  const restored = useRef<LocalDraft | null>(null);
  latest.current = input;
  const store = useMemo(() => new IndexedDraftStore(), []);
  const writer = useMemo(
    () =>
      new DraftWriter(store, (row, cause) => {
        if (!mounted.current) return;
        if (cause) {
          setError(draftError(cause));
          setStatus("本地草稿保存失败");
        } else if (row) {
          setError("");
          setStatus(`本地草稿已保存 ${new Date(row.updatedAt).toLocaleTimeString()}`);
          notifyDraft({ projectKey: row.projectKey, articleId: row.articleId, type: "write" });
        }
      }),
    [store],
  );
  function exitSnapshot(): LocalDraft | null {
    const state = latest.current;
    if (!state.article || !state.projectKey || !state.dirty) return null;
    return {
      schemaVersion: 1,
      key: draftKey(state.projectKey, state.article.id, sessionId),
      target: draftTarget(state.projectKey, state.article.id),
      projectKey: state.projectKey,
      articleId: state.article.id,
      sessionId,
      revision: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      format: state.article.format,
      baseVersion: state.article.version,
      baseSource: state.article.source,
      baseFrontmatter: state.article.frontmatter,
      source: state.source,
      frontmatter: state.frontmatter,
    };
  }
  useSessionRecovery({
    label: "文章草稿",
    snapshot: exitSnapshot,
    save: async () => {
      const row = exitSnapshot();
      if (!row) return;
      if (!saved.drafts.enabled)
        throw new Error("本地草稿自动保存已关闭，请下载未保存内容后登录。");
      await writer.checkpoint(row);
    },
  });
  const refresh = useCallback(async () => {
    if (!target) {
      setEntries([]);
      return;
    }
    try {
      const result = await store.list(input.projectKey, input.article!.id);
      if (
        target !==
        (latest.current.article
          ? draftTarget(latest.current.projectKey, latest.current.article.id)
          : "")
      )
        return;
      setEntries(
        result.entries.filter(
          (row) =>
            row.sessionId !== sessionId &&
            (row.source !== input.article!.source ||
              JSON.stringify(row.frontmatter.map(({ rowId, ...entry }) => entry)) !==
                JSON.stringify(input.article!.frontmatter)),
        ),
      );
      if (result.unreadable) setError("存在无法识别或来自更新版本的草稿，原始记录已保留。");
    } catch (cause) {
      if (mounted.current) setError(draftError(cause));
    }
  }, [store, target, sessionId, input.projectKey, input.article?.id, input.article?.version]);
  useEffect(() => {
    setUnavailable(false);
    setError("");
    setStatus("");
    void refresh();
  }, [refresh]);
  useEffect(() => {
    restored.current = null;
  }, [target]);
  useEffect(() => {
    if (!target) return;
    const event = (value: DraftEvent) => {
      if (!value || value.projectKey !== input.projectKey || value.articleId !== input.article?.id)
        return;
      if (value.type === "discard") {
        if (value.key === draftKey(input.projectKey, input.article!.id, sessionId))
          writer.forget(value.key);
        void refresh();
        return;
      }
      if (value.type === "rename" || value.type === "delete") {
        writer.cancel();
        const state = latest.current;
        if (
          state.dirty &&
          state.article?.id === value.articleId &&
          state.projectKey === value.projectKey &&
          !state.busy &&
          saved.drafts.enabled
        ) {
          const id = value.nextId ?? value.articleId;
          const session = crypto.randomUUID();
          const row: LocalDraft = {
            schemaVersion: 1,
            key: draftKey(state.projectKey, id, session),
            target: draftTarget(state.projectKey, id),
            articleId: id,
            projectKey: state.projectKey,
            sessionId: session,
            revision: crypto.randomUUID(),
            updatedAt: new Date().toISOString(),
            format: state.article.format,
            baseVersion: state.article.version,
            baseSource: state.article.source,
            baseFrontmatter: state.article.frontmatter,
            source: state.source,
            frontmatter: state.frontmatter,
            missing: value.type === "delete",
          };
          void store
            .put(row, null)
            .then(() =>
              notifyDraft({ projectKey: row.projectKey, articleId: row.articleId, type: "write" }),
            )
            .catch((cause) => setError(draftError(cause)));
        }
        setUnavailable(true);
        setError(
          value.type === "rename"
            ? `文章已在其他会话重命名为 ${value.nextId}，本地副本已迁移；请从草稿列表打开新路径。`
            : "文章已被删除，本地恢复副本仍保留，不会自动重建文件。",
        );
      }
      void refresh();
    };
    const local = (e: Event) => event((e as CustomEvent<DraftEvent>).detail);
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined")
        channel = new BroadcastChannel("mizuki-panel-drafts");
    } catch {
      // Browsers may disable cross-tab messaging; focusing the tab still refreshes drafts.
    }
    if (channel) channel.onmessage = (e) => event(e.data);
    window.addEventListener("mizuki-drafts", local);
    const focused = () => {
      void refresh();
    };
    window.addEventListener("focus", focused);
    return () => {
      channel?.close();
      window.removeEventListener("mizuki-drafts", local);
      window.removeEventListener("focus", focused);
    };
  }, [target, writer, refresh, sessionId, saved.drafts.enabled]);
  useEffect(() => {
    if (target && input.article && !input.dirty && !input.busy) {
      void writer.retire(draftKey(input.projectKey, input.article.id, sessionId));
      return;
    }
    if (
      !target ||
      !input.article ||
      !input.dirty ||
      input.busy ||
      input.readOnly ||
      unavailable ||
      !saved.drafts.enabled
    ) {
      writer.cancel();
      return;
    }
    const row: LocalDraft = {
      schemaVersion: 1,
      key: draftKey(input.projectKey, input.article.id, sessionId),
      target,
      projectKey: input.projectKey,
      articleId: input.article.id,
      sessionId,
      revision: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      format: input.article.format,
      baseVersion: input.article.version,
      baseSource: input.article.source,
      baseFrontmatter: input.article.frontmatter,
      source: input.source,
      frontmatter: input.frontmatter,
    };
    setStatus("本地草稿等待保存…");
    writer.schedule(row, saved.drafts.delay);
    return () => {
      /* A next render cancels superseded work; navigation flushes the final snapshot. */
    };
  }, [
    target,
    input.source,
    input.frontmatter,
    input.dirty,
    input.busy,
    input.readOnly,
    input.article?.version,
    unavailable,
    saved.drafts.enabled,
    saved.drafts.delay,
    sessionId,
    writer,
  ]);
  useEffect(() => {
    mounted.current = true;
    const flush = () => {
      void writer.flush();
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      void writer.flush();
      mounted.current = false;
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [writer]);
  const pause = async () => {
    const saving = writer.flush(true);
    writer.cancel();
    await saving;
  };
  const clearSaved = async (complete = true) => {
    if (input.article) await writer.retire(draftKey(input.projectKey, input.article.id, sessionId));
    if (complete && restored.current) {
      const row = restored.current;
      try {
        await store.remove(row.key, row.revision);
        restored.current = null;
        notifyDraft({
          projectKey: row.projectKey,
          articleId: row.articleId,
          key: row.key,
          type: "discard",
        });
      } catch (cause) {
        setError(draftError(cause));
      }
    }
    setStatus("");
    void refresh();
  };
  const discard = async (row: LocalDraft) => {
    try {
      await store.remove(row.key, row.revision);
      notifyDraft({
        projectKey: row.projectKey,
        articleId: row.articleId,
        key: row.key,
        type: "discard",
      });
      await refresh();
    } catch (cause) {
      setError(draftError(cause));
    }
  };
  const verify = async (row: LocalDraft) => {
    const current = await store.list(row.projectKey, row.articleId);
    if (!current.entries.some((entry) => entry.key === row.key && entry.revision === row.revision))
      throw new Error("恢复副本已更新或被丢弃，请刷新列表后重新选择。");
  };
  const relocate = async (nextId?: string) => {
    if (!input.article) return;
    await pause();
    try {
      await store.relocate(input.projectKey, input.article.id, nextId);
      notifyDraft({
        projectKey: input.projectKey,
        articleId: input.article.id,
        nextId,
        type: nextId ? "rename" : "delete",
      });
    } catch (cause) {
      setError(draftError(cause));
    }
  };
  return {
    entries,
    error,
    status: !saved.drafts.enabled ? "本地草稿自动保存已关闭" : status,
    refresh,
    pause,
    clearSaved,
    discard,
    relocate,
    sessionId,
    verify,
    markRestored: (row: LocalDraft) => {
      restored.current = row;
    },
  };
}
