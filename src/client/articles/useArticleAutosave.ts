import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import { autosaveOnExit, autosaveOnInterval } from "../../shared/article-autosave";
import { usePersonalSettings } from "../settings/PersonalSettingsProvider";
import { useSessionRecovery } from "../auth/useSessionRecovery";
import { sessionLifecycle } from "../auth/session-lifecycle";
import {
  articleDraftDirty,
  type ArticleAutoSaver,
  type ArticleAutosaveDraft,
} from "./article-autosave";

export function useArticleAutosave(input: {
  saver: ArticleAutoSaver;
  getDraft: () => ArticleAutosaveDraft;
  flush: () => void;
  pauseDraft: () => Promise<void>;
  reportError: (message: string) => void;
}) {
  const { saved } = usePersonalSettings();
  const latest = useRef({ ...input, settings: saved.articleAutosave });
  latest.current = { ...input, settings: saved.articleAutosave };
  const allowNext = useRef(false);
  const composing = useRef(false);
  const handlingBlock = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (sessionLifecycle.canNavigate()) return false;
    if (allowNext.current) {
      allowNext.current = false;
      return false;
    }
    return (
      articleDraftDirty(latest.current.getDraft()) &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search)
    );
  });
  async function saveOnExit() {
    const current = latest.current;
    current.flush();
    if (autosaveOnExit(current.settings)) {
      if (composing.current) throw new Error("请先完成输入法输入，再离开文章。");
      await current.saver.save(current.settings.scope);
    }
  }
  async function beforeLeave(): Promise<boolean> {
    try {
      await saveOnExit();
      if (
        articleDraftDirty(latest.current.getDraft()) &&
        !window.confirm("当前文章仍有未保存的修改，确定离开吗？")
      )
        return false;
      await latest.current.pauseDraft();
      return true;
    } catch (error) {
      latest.current.reportError(`离开前保存失败：${(error as Error).message}`);
      return false;
    }
  }
  useEffect(() => {
    if (blocker.state !== "blocked" || handlingBlock.current) return;
    handlingBlock.current = true;
    void Promise.resolve()
      .then(beforeLeave)
      .then((allowed) => {
        if (allowed) blocker.proceed();
        else blocker.reset();
      })
      .finally(() => {
        handlingBlock.current = false;
      });
  }, [blocker]);
  useEffect(() => {
    if (!autosaveOnInterval(saved.articleAutosave)) return;
    const timer = window.setInterval(() => {
      const current = latest.current;
      if (composing.current || sessionLifecycle.getState().exit || current.getDraft().busy) return;
      void current.saver
        .save(current.settings.scope, { timed: true })
        .catch((error) => current.reportError(`定时自动保存失败：${(error as Error).message}`));
    }, saved.articleAutosave.intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [saved.articleAutosave]);
  useEffect(() => {
    const start = () => {
      composing.current = true;
    };
    const end = () => {
      composing.current = false;
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (sessionLifecycle.canNavigate()) return;
      const current = latest.current;
      current.flush();
      if (!articleDraftDirty(current.getDraft())) return;
      if (autosaveOnExit(current.settings) && !composing.current)
        void current.saver
          .save(current.settings.scope, { keepalive: true })
          .catch((error) => current.reportError(`退出自动保存失败：${(error as Error).message}`));
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("compositionstart", start);
    document.addEventListener("compositionend", end);
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("compositionstart", start);
      document.removeEventListener("compositionend", end);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  useSessionRecovery({
    label: "文章自动保存",
    snapshot: () => null,
    save: async () => {
      // Expired credentials cannot write disk; existing local recovery handles those exits.
      if (sessionLifecycle.getState().exit?.reason === "logout") await saveOnExit();
    },
  });
  return {
    beforeLeave,
    allowNavigation: () => {
      allowNext.current = true;
    },
  };
}
