import { useCallback, useEffect, useMemo, useState } from "react";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import type { PublishOperationStatus, PublishOverview } from "../types";
import { operationLabels } from "./constants";

export type PublishDialog = "push" | "revert" | null;
export type PublishOperationKind = "validate" | "sync" | "build";

export function usePublish() {
  const [overview, setOverview] = useState<PublishOverview | null>(null);
  const [operation, setOperation] = useState<PublishOperationStatus | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState("feat(content): publish blog updates");
  const [diffPath, setDiffPath] = useState("");
  const [diff, setDiff] = useState("");
  const [dialog, setDialog] = useState<PublishDialog>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextOverview, nextOperation] = await Promise.all([
        api<PublishOverview>("/api/publish"),
        api<PublishOperationStatus>("/api/publish/operation"),
      ]);
      setOverview(nextOverview);
      setOperation(nextOperation);
      const available = new Set(
        nextOverview.changes
          .filter((change) => change.managed && !change.conflict)
          .map((change) => change.path),
      );
      setSelected((current) => current.filter((item) => available.has(item)));
      setError("");
    } catch (cause) {
      setError(errorMessage(cause, "发布状态读取失败"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (operation?.state !== "running") {
      return;
    }

    const timer = window.setInterval(() => void load(), 1200);
    return () => window.clearInterval(timer);
  }, [load, operation?.state]);

  const selectable = useMemo(
    () =>
      overview?.changes.filter((change) => change.managed && !change.conflict && !change.staged) ??
      [],
    [overview],
  );
  const allSelected =
    selectable.length > 0 && selectable.every((change) => selected.includes(change.path));
  const running = operation?.state === "running";

  function toggle(path: string) {
    setSelected((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path],
    );
  }

  function toggleAll() {
    setSelected(allSelected ? [] : selectable.map((change) => change.path));
  }

  async function showDiff(path: string) {
    setDiffPath(path);
    setDiff("");
    setError("");
    try {
      const result = await api<{ diff: string }>(
        `/api/publish/diff?path=${encodeURIComponent(path)}`,
      );
      setDiff(result.diff);
    } catch (cause) {
      setError(errorMessage(cause, "差异读取失败"));
    }
  }

  async function mutate(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      setNotice(success);
      setDialog(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause, "发布操作失败"));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    await mutate(
      () => api("/api/publish/commit", json("POST", { paths: selected, message: commitMessage })),
      "所选内容已创建 Git 提交。",
    );
  }

  async function startOperation(kind: PublishOperationKind) {
    await mutate(
      () => api("/api/publish/operation", json("POST", { kind })),
      `${operationLabels[kind]}已启动，请查看运行日志。`,
    );
  }

  async function push() {
    await mutate(() => api("/api/publish/push", json("POST")), "当前分支已推送。");
  }

  async function revert() {
    await mutate(() => api("/api/publish/revert", json("POST")), "已创建还原提交。");
  }

  return {
    overview,
    operation,
    selected,
    commitMessage,
    diffPath,
    diff,
    dialog,
    error,
    notice,
    busy,
    allSelected,
    running,
    load,
    setCommitMessage,
    setDiffPath,
    setDialog,
    setError,
    setNotice,
    toggle,
    toggleAll,
    showDiff,
    commit,
    startOperation,
    push,
    revert,
  };
}
