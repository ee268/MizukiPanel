import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import type { useLogin } from "./useLogin";
import { loginCardStyles as styles } from "./card-styles";
import PanelLogo from "../components/PanelLogo";

import { compactLogin, shortLogin, veryShortLogin } from "./login-layout";

export function LoginForm({ controller }: { controller: ReturnType<typeof useLogin> }) {
  const [visible, setVisible] = useState(false);
  return (
    <Paper
      variant="outlined"
      data-login-card="paper"
      sx={[
        styles.surface,
        {
          width: "100%",
          maxWidth: 430,
          minHeight: 390,
          display: "grid",
          p: 3,
          position: "relative",
          transition:
            "border-color 250ms ease, border-radius 250ms ease, background-color 250ms ease, box-shadow 250ms ease",
          [compactLogin]: { minHeight: 340 },
          [shortLogin]: { p: 2, minHeight: "min(310px, calc(100dvh - 64px))" },
        },
      ]}
    >
      <Stack
        component="form"
        useFlexGap
        spacing={3}
        sx={{
          width: "100%",
          justifyContent: "space-evenly",
          [compactLogin]: { gap: 2.5 },
          [shortLogin]: { gap: 1.5 },
        }}
        onSubmit={controller.submit}
        aria-label="登录 MizukiPanel"
        aria-busy={controller.busy}
      >
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography
              component="h2"
              sx={[
                styles.heading,
                {
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  minWidth: 0,
                  fontSize: { xs: 26, sm: 30 },
                  fontWeight: 650,
                  [compactLogin]: { fontSize: 24 },
                  [shortLogin]: { fontSize: 22 },
                },
              ]}
            >
              <Box component="span" sx={{ flexShrink: 0 }}>
                登录
              </Box>
              <PanelLogo
                align="start"
                sx={{
                  display: "block",
                  height: "1.4em",
                  width: "auto",
                  maxWidth: "calc(100% - 2.5em)",
                  objectFit: "contain",
                  objectPosition: "left center",
                }}
              />
            </Typography>
          </Stack>
          <Typography
            color="text.secondary"
            sx={[
              styles.description,
              {
                mt: 1,
                lineHeight: 1.7,
                [compactLogin]: { fontSize: 13, mt: 0.5 },
                [shortLogin]: { fontSize: 12 },
              },
            ]}
          >
            输入本次启动时终端显示的访问令牌。
          </Typography>
        </Box>
        {controller.error && (
          <Alert
            severity="error"
            sx={{ maxHeight: 72, overflow: "auto", [shortLogin]: { maxHeight: 48, py: 0 } }}
          >
            {controller.error}
          </Alert>
        )}
        <TextField
          label="访问令牌"
          value={controller.token}
          onChange={(event) => controller.setToken(event.target.value)}
          autoFocus
          fullWidth
          type={visible ? "text" : "password"}
          required
          disabled={controller.busy}
          autoComplete="off"
          sx={[styles.input, { [shortLogin]: { "& .MuiInputBase-input": { py: 1.25 } } }]}
          slotProps={{
            htmlInput: { spellCheck: false, autoCapitalize: "none", autoCorrect: "off" },
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={visible ? "隐藏令牌" : "显示令牌"}>
                    <IconButton
                      type="button"
                      aria-label={visible ? "隐藏令牌" : "显示令牌"}
                      aria-pressed={visible}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setVisible(!visible)}
                      edge="end"
                      disabled={controller.busy}
                    >
                      {visible ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            },
          }}
        />
        <Button
          variant="contained"
          size="large"
          type="submit"
          disabled={controller.busy}
          endIcon={
            controller.busy ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <ArrowForwardOutlined />
            )
          }
          sx={[
            {
              py: 1.6,
              "& .MuiButton-endIcon": { transition: "transform 220ms ease" },
              "&:hover .MuiButton-endIcon": { transform: "translateX(3px)" },
              [compactLogin]: { py: 1.2 },
              [shortLogin]: { py: 0.9 },
            },
            styles.button,
            {
              "&.Mui-disabled": {
                color: "action.disabled",
                bgcolor: "action.disabledBackground",
                borderColor: "action.disabledBackground",
                backgroundImage: "none",
                boxShadow: "none",
              },
            },
          ]}
        >
          {controller.busy ? "验证中…" : "进入面板"}
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            lineHeight: 1.8,
            textAlign: "left",
            [shortLogin]: { fontSize: 11 },
            [veryShortLogin]: { display: "none" },
          }}
        >
          准备好了，就回到自己的创作空间。
        </Typography>
      </Stack>
    </Paper>
  );
}
