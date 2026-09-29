import { type FormEvent, useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography, useTheme } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import LockOutlined from "@mui/icons-material/LockOutlined";
import { useNavigate } from "react-router-dom";
import { api, json } from "../api";

function translucent(color: string, percentage: number): string {
  return "color-mix(in srgb, " + color + " " + percentage + "%, transparent)";
}

const gradientFlow = keyframes({
  "0%": { backgroundPosition: "0% 45%, 100% 20%, 0% 50%" },
  "35%": { backgroundPosition: "35% 20%, 65% 70%, 45% 50%" },
  "70%": { backgroundPosition: "80% 65%, 15% 35%, 100% 50%" },
  "100%": { backgroundPosition: "0% 45%, 100% 20%, 0% 50%" },
});

const firstGlowFlow = keyframes({
  "0%, 100%": { transform: "translate3d(-8%, -6%, 0) scale(1)" },
  "45%": { transform: "translate3d(16%, 10%, 0) scale(1.14)" },
  "75%": { transform: "translate3d(5%, 18%, 0) scale(0.94)" },
});

const secondGlowFlow = keyframes({
  "0%, 100%": { transform: "translate3d(10%, 8%, 0) scale(1.06)" },
  "40%": { transform: "translate3d(-14%, 15%, 0) scale(0.92)" },
  "72%": { transform: "translate3d(-4%, -12%, 0) scale(1.12)" },
});

export default function LoginPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dark = theme.palette.mode === "dark";
  const primarySoft = translucent(theme.palette.primary.main, dark ? 24 : 20);
  const primaryGlow = translucent(theme.palette.primary.main, dark ? 30 : 24);
  const secondarySoft = translucent(theme.palette.secondary.main, dark ? 20 : 16);
  const secondaryGlow = translucent(theme.palette.secondary.main, dark ? 24 : 18);
  const base = theme.palette.background.default;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", json("POST", { token }));
      navigate("/", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        isolation: "isolate",
        overflow: "hidden",
        p: 3,
        position: "relative",
        backgroundColor: base,
        backgroundImage: [
          "radial-gradient(circle at 16% 22%, " + primarySoft + " 0%, transparent 38%)",
          "radial-gradient(circle at 84% 18%, " + secondarySoft + " 0%, transparent 36%)",
          "linear-gradient(125deg, " +
            base +
            " 5%, " +
            translucent(theme.palette.primary.main, dark ? 12 : 8) +
            " 40%, " +
            translucent(theme.palette.secondary.main, dark ? 10 : 7) +
            " 68%, " +
            base +
            " 96%)",
        ].join(","),
        backgroundSize: "170% 170%, 180% 180%, 320% 320%",
        animation: gradientFlow + " 28s ease-in-out infinite",
        "&::before, &::after": {
          content: '""',
          position: "absolute",
          width: { xs: "78vmax", md: "58vmax" },
          height: { xs: "78vmax", md: "58vmax" },
          borderRadius: "50%",
          filter: "blur(72px)",
          pointerEvents: "none",
          willChange: "transform",
          zIndex: -1,
        },
        "&::before": {
          top: "-38vmax",
          left: "-28vmax",
          background: "radial-gradient(circle, " + primaryGlow + " 0%, transparent 66%)",
          animation: firstGlowFlow + " 24s ease-in-out infinite",
        },
        "&::after": {
          right: "-30vmax",
          bottom: "-40vmax",
          background: "radial-gradient(circle, " + secondaryGlow + " 0%, transparent 66%)",
          animation: secondGlowFlow + " 31s ease-in-out infinite",
        },
        "@media (prefers-reduced-motion: reduce)": {
          animation: "none",
          "&::before, &::after": { animation: "none" },
        },
      }}
    >
      <Paper
        elevation={8}
        sx={{
          width: "100%",
          maxWidth: 440,
          p: { xs: 3, sm: 5 },
          position: "relative",
          bgcolor: translucent(theme.palette.background.paper, dark ? 92 : 88),
          backdropFilter: "blur(18px)",
          border: "1px solid",
          borderColor: translucent(theme.palette.primary.main, dark ? 22 : 16),
        }}
      >
        <Stack spacing={3} component="form" onSubmit={submit}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 3,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "grid",
              placeItems: "center",
            }}
          >
            <LockOutlined />
          </Box>
          <Box>
            <Typography variant="h4">登录 MizukiPanel</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              输入本次启动时终端显示的访问令牌。
            </Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="访问令牌"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoFocus
            fullWidth
            type="password"
            required
          />
          <Button variant="contained" size="large" type="submit" disabled={busy}>
            {busy ? "验证中…" : "进入面板"}
          </Button>
        </Stack>
      </Paper>
      <Typography
        component="footer"
        variant="body2"
        color="text.secondary"
        sx={{
          position: "absolute",
          bottom: { xs: 16, sm: 24 },
          left: 24,
          right: 24,
          zIndex: 1,
          textAlign: "center",
        }}
      >
        © 2026 ee268
      </Typography>
    </Box>
  );
}
