import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import { notifySiteIdentityChanged } from "../shared/site-identity";
import type { DashboardOverview } from "../types";
import type { WorkspaceData, WorkspaceState } from "./types";

export interface WorkspaceController extends WorkspaceState {
  setProjectPath: (path: string) => void;
  connect: (event: FormEvent) => Promise<void>;
  selectAndConnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useWorkspace(): WorkspaceController {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardOverview | null>(null);
  const [projectPath, setProjectPath] = useState("");
  const [error, setError] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setDashboardError("");

    try {
      const next = await api<WorkspaceData>("/api/workspace");
      setData(next);
      setProjectPath(next.connectedPath ?? "");
      setDashboard(null);

      if (next.report) {
        try {
          setDashboard(await api<DashboardOverview>("/api/dashboard"));
        } catch (cause) {
          setDashboardError(errorMessage(cause, "数据总览读取失败"));
        }
      }
    } catch (cause) {
      setError(errorMessage(cause, "工作区读取失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const connectProject = useCallback(
    async (nextPath: string) => {
      await api("/api/workspace/connect", json("POST", { projectPath: nextPath }));
      setProjectPath(nextPath);
      await reload();
      notifySiteIdentityChanged();
    },
    [reload],
  );

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await connectProject(projectPath);
    } catch (cause) {
      setError(errorMessage(cause, "连接失败"));
    } finally {
      setBusy(false);
    }
  }

  async function selectAndConnect() {
    setBusy(true);
    setError("");

    try {
      const result = await api<{ path: string | null }>(
        "/api/workspace/select-directory",
        json("POST", { initialPath: projectPath }),
      );
      if (result.path) {
        await connectProject(result.path);
      }
    } catch (cause) {
      setError(errorMessage(cause, "无法选择文件夹"));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError("");

    try {
      await api("/api/workspace/disconnect", json("POST"));
      await reload();
      notifySiteIdentityChanged();
    } catch (cause) {
      setError(errorMessage(cause, "断开失败"));
    } finally {
      setBusy(false);
    }
  }

  return {
    data,
    dashboard,
    projectPath,
    error,
    dashboardError,
    busy,
    loading,
    setProjectPath,
    connect,
    selectAndConnect,
    disconnect,
    reload,
  };
}
