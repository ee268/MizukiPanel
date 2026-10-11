import { useEffect, useState } from "react";
import { Alert, Button, Box } from "@mui/material";
import { ContentLoading } from "../components/ContentLoading";
import { Navigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { SessionGuard } from "./SessionGuard";
import AppShell from "../layout/AppShell";

type AuthState = "loading" | "ready" | "login" | "error";

export default function RequireAuth() {
  const [state, setState] = useState<AuthState>("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    api("/api/session")
      .then(() => setState("ready"))
      .catch((cause) => {
        if (cause instanceof ApiError && cause.status === 401) setState("login");
        else {
          setError(cause.message);
          setState("error");
        }
      });
  }, [attempt]);

  if (state === "loading") {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", alignItems: "center", p: 4 }}>
        <ContentLoading heading="正在验证登录" description="正在确认会话并准备面板" kind="page" />
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
      <AppShell />
      <SessionGuard />
    </>
  );
}
