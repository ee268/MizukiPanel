import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import type { DashboardOverview } from "../types";
import { useWorkspaceSession } from "./WorkspaceSessionProvider";
import { useWorkspaceActions } from "./useWorkspaceActions";

export function useWorkspace() {
  const session = useWorkspaceSession();
  const actions = useWorkspaceActions();
  const [dashboard, setDashboard] = useState<DashboardOverview | null>(null);
  const [projectPath, setProjectPath] = useState(session.data?.connectedPath ?? "");
  const [dashboardError, setDashboardError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [selecting, setSelecting] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setDashboard(null);
    setDashboardError("");
    setLoading(true);
    setProjectPath(session.data?.connectedPath ?? "");
    if (!session.data?.report) {
      setLoading(false);
      return;
    }
    void api<DashboardOverview>("/api/dashboard", { signal: abort.signal })
      .then((next) => {
        if (!abort.signal.aborted) setDashboard(next);
      })
      .catch((cause) => {
        if (!abort.signal.aborted) setDashboardError(errorMessage(cause, "数据总览读取失败"));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [session.data?.version, revision]);
  const reload = useCallback(async () => {
    try {
      await session.refresh();
      setRevision((value) => value + 1);
    } catch (cause) {
      actions.setError(errorMessage(cause, "工作区读取失败"));
    }
  }, [session.refresh]);
  async function selectAndConnect() {
    if (selecting || actions.busy) return;
    setSelecting(true);
    try {
      const result = await api<{ path: string | null }>(
        "/api/workspace/select-directory",
        json("POST", { initialPath: projectPath }),
      );
      if (result.path) await actions.connect(result.path);
    } catch (cause) {
      actions.setError(errorMessage(cause, "无法选择文件夹"));
    } finally {
      setSelecting(false);
    }
  }
  return {
    ...actions,
    busy: actions.busy || selecting,
    data: session.data,
    dashboard,
    projectPath,
    dashboardError,
    loading,
    setProjectPath,
    reload,
    selectAndConnect,
    connect: async (event: FormEvent) => {
      event.preventDefault();
      await actions.connect(projectPath);
    },
    connectPath: actions.connect,
  };
}
