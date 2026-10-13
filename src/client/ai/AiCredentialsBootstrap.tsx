import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert } from "@mui/material";
import { api } from "../api";
import type { AiVaultStatus } from "../../shared/ai-vault";
import { aiCredentials } from "./credentials";
import { sessionLifecycle } from "../auth/session-lifecycle";
import { usePersonalSettings } from "../settings/PersonalSettingsProvider";
import { RouteLoading } from "../components/RouteLoading";

export function AiCredentialsBootstrap({ children }: { children: ReactNode }) {
  const preferences = usePersonalSettings();
  const current = useRef(preferences);
  current.current = preferences;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    const epoch = sessionLifecycle.getEpoch();
    void (async () => {
      try {
        await current.current.load(abort.signal);
        const status = await api<AiVaultStatus>("/api/ai/credentials", { signal: abort.signal });
        if (
          abort.signal.aborted ||
          epoch !== sessionLifecycle.getEpoch() ||
          sessionLifecycle.getState().exit
        )
          return;
        aiCredentials.adopt(status);
      } catch (cause) {
        if (!abort.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "本机设置恢复失败，请检查 .local 目录权限。",
          );
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    })();
    return () => abort.abort();
  }, []);
  if (loading) return <RouteLoading fullPage />;
  return (
    <>
      {error && <Alert severity="warning">{error}</Alert>}
      {children}
    </>
  );
}
