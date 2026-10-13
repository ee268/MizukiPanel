import { Box, Container, Typography, useMediaQuery, useTheme } from "@mui/material";
import { LoginForm } from "../login/LoginForm";
import { LoginScene } from "../login/LoginScene";
import { useLogin } from "../login/useLogin";
import { loginArrival, loginBackground } from "../login/login-styles";

import {
  compactLogin,
  shortLogin,
  landscapeLogin,
  mobileLogin,
  mobileLoginQuery,
} from "../login/login-layout";

export default function LoginPage() {
  const theme = useTheme();
  const mobile = useMediaQuery(mobileLoginQuery);
  const controller = useLogin();
  return (
    <Box sx={loginBackground(theme)}>
      <Container
        maxWidth="lg"
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          py: { xs: 2, sm: 3 },
          px: { xs: 2, sm: 3 },
          gap: 1.5,
          position: "relative",
          zIndex: 1,
          [compactLogin]: { py: 1.5, gap: 1 },
          [shortLogin]: { py: 1, gap: 2 },
        }}
      >
        <Box
          component="main"
          sx={{
            display: "grid",
            flex: 1,
            minHeight: 0,
            alignContent: "center",
            alignItems: "center",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "1.12fr .88fr" },
            gridTemplateAreas: { xs: '"form" "scene"', sm: '"scene form"' },
            gap: { xs: 2.5, sm: 4, md: 7 },
            py: 1,
            mx: "auto",
            width: "100%",
            [compactLogin]: { gap: 2, py: 0 },
            [shortLogin]: { gap: 1.5 },
            [landscapeLogin]: { gridTemplateColumns: "1fr 1fr", gridTemplateAreas: '"scene form"' },
            [mobileLogin]: { gridTemplateColumns: "minmax(0, 1fr)", gridTemplateAreas: '"form"' },
          }}
        >
          {!mobile && (
            <Box sx={{ gridArea: "scene", minWidth: 0, px: { xs: 1, sm: 0 } }}>
              <LoginScene />
            </Box>
          )}
          <Box
            sx={{
              gridArea: "form",
              minWidth: 0,
              display: "flex",
              justifyContent: "center",
              animation: loginArrival,
            }}
          >
            <LoginForm controller={controller} />
          </Box>
        </Box>
        <Typography
          component="footer"
          variant="caption"
          color="text.secondary"
          sx={{
            textAlign: "center",
            lineHeight: 1.5,
            flexShrink: 0,
            [shortLogin]: { fontSize: 11 },
          }}
        >
          Copyright © 2026 desgined by ee268
        </Typography>
      </Container>
    </Box>
  );
}
