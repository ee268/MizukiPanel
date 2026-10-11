import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from "@mui/material";
import { api, setWorkspaceVersion } from "../api";
import { ContentLoading } from "../components/ContentLoading";
import type { WorkspaceData } from "./types";
import type { ProjectReport } from "../types";

const Context = createContext<{
  data: WorkspaceData | null;
  refresh: () => Promise<WorkspaceData>;
  adopt: (data: WorkspaceData) => void;
  notify: () => void;
  outletVersion: number;
  error: string;
  stale: boolean;
} | null>(null);
export function WorkspaceSessionProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [outletVersion, setOutletVersion] = useState(0);
  const [pending, setPending] = useState<WorkspaceData | null>(null);
  const [acknowledged, setAcknowledged] = useState("");
  const [error, setError] = useState("");
  const current = useRef<WorkspaceData | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const requestSequence = useRef(0);
  const adopt = useCallback((next: WorkspaceData) => {
    requestSequence.current += 1;
    if (current.current?.version !== next.version) setOutletVersion((value) => value + 1);
    current.current = next;
    setWorkspaceVersion(next.version);
    setData(next);
    setPending(null);
    setError("");
    setInitialized(true);
    channel.current?.postMessage("changed");
  }, []);
  const refresh = useCallback(async () => {
    const request = ++requestSequence.current;
    const next = await api<WorkspaceData>("/api/workspace");
    if (request !== requestSequence.current) return next;
    if (current.current && current.current.version !== next.version) {
      setPending(next);
    } else {
      current.current = next;
      setWorkspaceVersion(next.version);
      setData(next);
      setError("");
      setInitialized(true);
    }
    return next;
  }, []);
  useEffect(() => {
    let alive = true;
    const check = () => {
      void refresh().catch((cause) => {
        if (alive) {
          setError((cause as Error).message);
          setInitialized(true);
        }
      });
    };
    check();
    const broadcast =
      typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("mizuki-workspace");
    channel.current = broadcast;
    if (broadcast) broadcast.onmessage = check;
    window.addEventListener("focus", check);
    const interval = window.setInterval(check, 15000);
    return () => {
      alive = false;
      broadcast?.close();
      channel.current = null;
      window.removeEventListener("focus", check);
      clearInterval(interval);
    };
  }, [refresh]);
  return (
    <Context.Provider
      value={{
        data,
        refresh,
        adopt,
        outletVersion,
        error,
        stale: Boolean(pending),
        notify: () => channel.current?.postMessage("changed"),
      }}
    >
      {initialized ? (
        children
      ) : (
        <Stack sx={{ p: 4 }} spacing={2}>
          <ContentLoading
            heading="正在展开工作区"
            description="正在读取项目连接与工作区状态"
            kind="page"
          />
        </Stack>
      )}
      <Dialog
        open={Boolean(pending && pending.version !== acknowledged)}
        aria-labelledby="workspace-changed-title"
      >
        <DialogTitle id="workspace-changed-title">工作区已在其他位置切换</DialogTitle>
        <DialogContent>
          新的连接：{pending?.connectedPath || "未连接项目"}
          。当前输入仍保留，保存请求会被拒绝。请确认未保存内容后重新载入；浏览器会在存在未保存修改时提示。
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAcknowledged(pending?.version ?? "")}>保留当前输入</Button>
          <Button variant="contained" onClick={() => window.location.reload()}>
            重新载入页面
          </Button>
        </DialogActions>
      </Dialog>
    </Context.Provider>
  );
}
export function useWorkspaceSession() {
  const value = useContext(Context);
  if (!value) throw new Error("工作区上下文不可用。");
  return value;
}
export function useCurrentProjectReadOnly(root?: string, fallback = false) {
  const value = useContext(Context);
  return root && value?.data?.report?.root === root ? value.data.report.readOnly : fallback;
}
export function useLiveProjectReport(report: ProjectReport | null) {
  const value = useContext(Context);
  return report && value?.data?.report?.root === report.root ? value.data.report : report;
}
export function useLiveProjectDocument<T extends { report: ProjectReport; readOnly: boolean }>(
  document: T | null,
  additionalReadOnly = false,
): T | null {
  const report = useLiveProjectReport(document?.report ?? null);
  return useMemo(
    () =>
      document && report
        ? { ...document, report, readOnly: report.readOnly || additionalReadOnly }
        : document,
    [document, report, additionalReadOnly],
  );
}
