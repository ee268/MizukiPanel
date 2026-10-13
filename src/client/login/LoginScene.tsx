import { Box, Stack, Typography } from "@mui/material";
import { loginArrival } from "./login-styles";
import { NoteWidget } from "./NoteWidget";

import { compactLogin, shortLogin, veryShortLogin } from "./login-layout";

export function LoginScene() {
  return (
    <Stack
      useFlexGap
      spacing={4}
      sx={{
        animation: loginArrival,
        textAlign: "left",
        maxWidth: 520,
        [compactLogin]: { gap: 3 },
        [shortLogin]: { gap: 1.5 },
      }}
    >
      <Box className="login-scene-intro" sx={{ [veryShortLogin]: { display: "none" } }}>
        <Typography variant="overline" color="primary" sx={{ [compactLogin]: { fontSize: 11 } }}>
          A SPACE TO CREATE
        </Typography>
        <Typography
          component="h1"
          sx={{
            mt: 1,
            mb: 2,
            fontSize: { xs: 28, md: 42 },
            fontWeight: 750,
            lineHeight: 1.25,
            letterSpacing: "-.025em",
            [compactLogin]: { fontSize: { xs: 24, sm: 30 }, mt: 0, mb: 1.5 },
            [shortLogin]: { fontSize: 22, mb: 0.5 },
          }}
        >
          从这里，开始下一篇。
        </Typography>
        <Typography
          color="text.secondary"
          sx={{
            lineHeight: 1.7,
            maxWidth: 480,
            [compactLogin]: { fontSize: 13 },
          }}
        >
          把想写的故事、想整理的图片，放进自己的博客。
        </Typography>
      </Box>
      <NoteWidget />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ [shortLogin]: { fontSize: 11 }, [veryShortLogin]: { display: "none" } }}
      >
        先留下一点灵感，再开始创作。
      </Typography>
    </Stack>
  );
}
