import { useEffect, useState } from "react";
import { Alert, Button, Box, CircularProgress, Typography } from "@mui/material";
import { Navigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { SessionGuard } from "./SessionGuard";
import AppShell from "../layout/AppShell";
import { connectSession } from "./session-connection";
import { AiCredentialsBootstrap } from "../ai/AiCredentialsBootstrap";

type AuthState = "loading" | "ready" | "login" | "error";

export default function RequireAuth() {
  const [state, setState] = useState<AuthState>("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setReconnecting(false);
    connectSession(
      (signal) => api("/api/session", { signal }),
      controller.signal,
      () => setReconnecting(true),
    )
      .then(() => {
        if (!controller.signal.aborted) setState("ready");
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiError && cause.status === 401) setState("login");
        else {
          setError(cause.message);
          setState("error");
        }
      });
    return () => controller.abort();
  }, [attempt]);

  if (state === "loading") {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3 }}>
        <Box role="status" sx={{ textAlign: "center" }}>
          <CircularProgress aria-label={reconnecting ? "正在重新连接" : "正在验证登录"} />
          {reconnecting && (
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              服务正在启动或重新连接，将持续自动重试…
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  if (state === "login") {
    return <Navigate to="/login" replace />;
  }

  if (state === "error")
    return (
      <Box sx={{ p: 4 }}>
        <Alert
          severity="error"
          action={
            <Button
              onClick={() => {
                setState("loading");
                setAttempt((value) => value + 1);
              }}
            >
              重试
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  return (
    <>
      <AiCredentialsBootstrap>
        <AppShell />
      </AiCredentialsBootstrap>
      <SessionGuard />
    </>
  );
}
