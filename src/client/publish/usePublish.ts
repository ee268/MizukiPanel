import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import type {
  PublishCommitDetail,
  PublishHistory,
  PublishOperationStatus,
  PublishOverview,
} from "../types";
import { commitPrefix } from "../../shared/task-settings";

export function usePublish() {
  const [overview, setOverview] = useState<PublishOverview | null>(null);
  const [operation, setOperation] = useState<PublishOperationStatus | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [tab, setTab] = useState("history");
  const [history, setHistory] = useState<PublishHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [commitType, setCommitType] = useState("feat");
  const [commitScope, setCommitScope] = useState("content");
  const [commitDescription, setCommitDescription] = useState("");
  const formTouched = useRef(false),
    initialized = useRef(false),
    alive = useRef(true);
  const loadRequest = useRef(0),
    historyRequest = useRef(0),
    detailRequest = useRef(0);
  const overviewRef = useRef<PublishOverview | null>(null);
  const busyRef = useRef(false);
  const [detailTitle, setDetailTitle] = useState("");
  const [detail, setDetail] = useState<PublishCommitDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const commitMessage = commitPrefix(commitType, commitScope) + commitDescription;
  const refreshLogs = useCallback(async () => {
    const next = await api<PublishOperationStatus>("/api/publish/operation");
    if (alive.current) setOperation(next);
    return next;
  }, []);
  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    try {
      const next = await api<PublishOverview>("/api/publish");
      if (!alive.current || request !== loadRequest.current) return;
      if (overviewRef.current?.head !== next.head) setHistoryPage(1);
      overviewRef.current = next;
      setOverview(next);
      if (!initialized.current && !formTouched.current) {
        initialized.current = true;
        if (next.preferences?.remember) {
          setCommitType(next.preferences.type);
          setCommitScope(next.preferences.scope);
        }
      }
      const available = new Set(
        next.changes.filter((c) => !c.conflict && !c.staged).map((c) => c.path),
      );
      setSelected((current) => current.filter((p) => available.has(p)));
      setError("");
      await refreshLogs();
    } catch (cause) {
      if (alive.current && request === loadRequest.current)
        setError(errorMessage(cause, "仓库状态读取失败"));
    }
  }, [refreshLogs]);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      loadRequest.current++;
      historyRequest.current++;
      detailRequest.current++;
    };
  }, [load]);
  useEffect(() => {
    if (!overview?.repositoryAvailable || tab !== "history") return;
    const request = ++historyRequest.current;
    const abort = new AbortController();
    setHistoryLoading(true);
    setHistoryError("");
    const params = new URLSearchParams({ page: String(historyPage) });
    if (overview.head) params.set("head", overview.head);
    void api<PublishHistory>(`/api/publish/history?${params}`, { signal: abort.signal })
      .then((next) => {
        if (request === historyRequest.current) setHistory(next);
      })
      .catch((cause) => {
        if (!abort.signal.aborted && request === historyRequest.current)
          setHistoryError(errorMessage(cause, "提交历史读取失败"));
      })
      .finally(() => {
        if (!abort.signal.aborted && request === historyRequest.current) {
          setHistoryLoading(false);
          void refreshLogs().catch(() => {});
        }
      });
    return () => abort.abort();
  }, [overview, historyPage, tab, refreshLogs]);
  const running = operation?.state === "running";
  useEffect(() => {
    if (!running && !busy) return;
    let polling = false;
    const timer = window.setInterval(() => {
      if (polling) return;
      polling = true;
      void refreshLogs()
        .then((next) => {
          if (next.state !== "running" && !busyRef.current) void load();
        })
        .catch(() => {})
        .finally(() => {
          polling = false;
        });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, busy, refreshLogs, load]);
  const selectable = useMemo(
    () => overview?.changes.filter((c) => !c.conflict && !c.staged) ?? [],
    [overview],
  );
  const allSelected = selectable.length > 0 && selectable.every((c) => selected.includes(c.path));
  function toggle(path: string) {
    setSelected((current) =>
      current.includes(path) ? current.filter((p) => p !== path) : [...current, path],
    );
  }
  function toggleAll() {
    setSelected(allSelected ? [] : selectable.map((c) => c.path));
  }
  async function showDetail(title: string, url: string, file = false) {
    const request = ++detailRequest.current;
    setDetailTitle(title);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const next = await api<PublishCommitDetail | { diff: string }>(url);
      if (alive.current && request === detailRequest.current)
        setDetail(
          file
            ? { sha: "", message: "", diff: next.diff, truncated: false }
            : (next as PublishCommitDetail),
        );
    } catch (cause) {
      if (alive.current && request === detailRequest.current)
        setDetailError(errorMessage(cause, "差异读取失败"));
    } finally {
      if (alive.current && request === detailRequest.current) setDetailLoading(false);
      void refreshLogs().catch(() => {});
    }
  }
  async function mutate(task: () => Promise<unknown>, success: string) {
    if (busyRef.current || running) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await task();
      if (!alive.current) return;
      setNotice(success);
      await load();
      if (
        result &&
        typeof result === "object" &&
        "defaultsWarning" in result &&
        result.defaultsWarning
      )
        setError(String(result.defaultsWarning));
    } catch (cause) {
      if (alive.current) setError(errorMessage(cause, "操作失败"));
    } finally {
      busyRef.current = false;
      if (alive.current) {
        setBusy(false);
        void refreshLogs().catch(() => {});
      }
    }
  }
  async function commit() {
    await mutate(async () => {
      const result = await api(
        "/api/publish/commit",
        json("POST", { paths: selected, message: commitMessage }),
      );
      if (alive.current) {
        setSelected([]);
        setCommitDescription("");
        setHistoryPage(1);
      }
      return result;
    }, "已在 Mizuki 当前分支创建提交。");
  }
  return {
    overview,
    operation,
    selected,
    tab,
    setTab,
    history,
    historyLoading,
    historyError,
    historyPage,
    setHistoryPage,
    commitMessage,
    commitType,
    commitScope,
    commitDescription,
    detailTitle,
    detail,
    detailLoading,
    detailError,
    error,
    notice,
    busy,
    running,
    allSelected,
    load,
    refreshLogs,
    setError,
    setNotice,
    toggle,
    toggleAll,
    commit,
    setCommitType: (value: string) => {
      formTouched.current = true;
      setCommitType(value);
    },
    setCommitScope: (value: string) => {
      formTouched.current = true;
      setCommitScope(value);
    },
    setCommitDescription: (value: string) => {
      formTouched.current = true;
      setCommitDescription(value);
    },
    showDiff: (path: string) =>
      showDetail(`文件差异 · ${path}`, `/api/publish/diff?path=${encodeURIComponent(path)}`, true),
    showCommit: (sha: string) =>
      showDetail(
        `提交详情 · ${sha.slice(0, 12)}`,
        `/api/publish/commit-detail?sha=${encodeURIComponent(sha)}`,
      ),
    closeDetail: () => {
      detailRequest.current++;
      setDetailTitle("");
      setDetailLoading(false);
    },
    build: () =>
      mutate(
        () => api("/api/publish/operation", json("POST", { kind: "build" })),
        "Mizuki 构建已启动，请查看运行日志。",
      ),
  };
}
