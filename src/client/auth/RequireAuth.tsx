import { useEffect, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import { Navigate } from "react-router-dom";
import { api } from "../api";
import AppShell from "../layout/AppShell";

type AuthState = "loading" | "ready" | "login";

export default function RequireAuth() {
  const [state, setState] = useState<AuthState>("loading");

  useEffect(() => {
    api("/api/session")
      .then(() => setState("ready"))
      .catch(() => setState("login"));
  }, []);

  if (state === "loading") {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (state === "login") {
    return <Navigate to="/login" replace />;
  }

  return <AppShell />;
}
