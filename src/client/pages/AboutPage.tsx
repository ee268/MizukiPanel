import { Box, Container, Typography } from "@mui/material";
import { AboutEditorial } from "../about/AboutEditorial";
import { aboutPageMotion } from "../about/AboutMotion";

export default function AboutPage() {
  return (
    <Container
      maxWidth="lg"
      sx={{
        py: { xs: 3, md: 5 },
        "@media (prefers-reduced-motion: reduce)": {
          "& *, & *::before, & *::after": {
            animation: "none !important",
            transition: "none !important",
            scrollBehavior: "auto !important",
          },
          "& .MuiButtonBase-root:hover": { transform: "none" },
          "& .MuiPaper-root:hover, & .about-feature-icon": { transform: "none !important" },
        },
      }}
    >
      <Typography
        variant="overline"
        color="text.secondary"
        data-page-motion="heading"
        sx={{ display: "block", mb: 3 }}
      >
        关于 MizukiPanel
      </Typography>
      <Box data-about-layout="editorial" sx={{ animation: aboutPageMotion }}>
        <AboutEditorial />
      </Box>
      <Typography
        align="center"
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 5 }}
      >
        MizukiPanel · 在本地，打理你的博客。
      </Typography>
    </Container>
  );
}
