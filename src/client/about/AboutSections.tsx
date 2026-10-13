import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  ButtonBase,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowOutwardOutlined from "@mui/icons-material/ArrowOutwardOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import GitHub from "@mui/icons-material/GitHub";
import DashboardCustomizeOutlined from "@mui/icons-material/DashboardCustomizeOutlined";
import { aboutContentMotion, aboutDrift, interactiveSurface } from "./AboutMotion";
import { capabilities, repositoryUrl, workflow } from "./content";

export function AboutBrand({ large = false }: { large?: boolean }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "relative",
        width: large ? { xs: 180, md: 240 } : 140,
        height: large ? { xs: 180, md: 240 } : 140,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: "6%",
          border: 1,
          borderColor: "color-mix(in srgb, var(--mui-palette-primary-main) 22%, transparent)",
          borderRadius: "32%",
          transform: "rotate(12deg)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: "18%",
          bgcolor: "color-mix(in srgb, var(--mui-palette-primary-main) 10%, transparent)",
          borderRadius: "28%",
          animation: aboutDrift,
        }}
      />
      <DashboardCustomizeOutlined
        sx={{ color: "primary.main", fontSize: large ? { xs: 78, md: 110 } : 64, zIndex: 1 }}
      />
      {["12%", "80%"].map((left, index) => (
        <Box
          key={left}
          sx={{
            position: "absolute",
            left,
            top: index ? "72%" : "17%",
            width: 12,
            height: 12,
            borderRadius: "50%",
            bgcolor: index ? "secondary.main" : "primary.main",
          }}
        />
      ))}
    </Box>
  );
}

export function AboutFeatureCard({
  feature,
  numbered = false,
}: {
  feature: (typeof capabilities)[number];
  numbered?: boolean;
}) {
  return (
    <Paper variant="outlined" sx={[interactiveSurface, { height: "100%", overflow: "hidden" }]}>
      <ButtonBase
        component={RouterLink}
        to={feature.path}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          textAlign: "left",
          width: "100%",
          height: "100%",
          p: { xs: 2.5, sm: 3 },
          gap: 2,
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Box
            className="about-feature-icon"
            sx={{
              display: "grid",
              placeItems: "center",
              width: 46,
              height: 46,
              borderRadius: "14px",
              color: "primary.main",
              bgcolor: "color-mix(in srgb, var(--mui-palette-primary-main) 10%, transparent)",
              transition: "transform 240ms ease",
            }}
          >
            <feature.Icon />
          </Box>
          {numbered ? (
            <Typography color="text.secondary" variant="caption">
              0{capabilities.indexOf(feature) + 1}
            </Typography>
          ) : (
            <ArrowOutwardOutlined sx={{ color: "text.disabled", fontSize: 19 }} />
          )}
        </Stack>
        <Typography component="h3" variant="h6">
          {feature.label}
        </Typography>
        <Typography color="text.secondary" sx={{ lineHeight: 1.85, flex: 1 }}>
          {feature.description}
        </Typography>
        <Typography variant="caption" color="primary" sx={{ lineHeight: 1.7 }}>
          {feature.detail}
        </Typography>
      </ButtonBase>
    </Paper>
  );
}

export function AboutWorkflow() {
  const [step, setStep] = useState(0);
  const current = workflow[step];
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: "22px" }}>
      <Typography component="h2" variant="h5" sx={{ mb: 2.5 }}>
        从一篇文章，到一次更新
      </Typography>
      <Box
        role="tablist"
        aria-label="博客管理流程"
        sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 1, mb: 3 }}
      >
        {workflow.map((item, index) => (
          <ButtonBase
            key={item.title}
            role="tab"
            id={`about-step-${index}`}
            aria-selected={step === index}
            aria-controls="about-step-content"
            tabIndex={step === index ? 0 : -1}
            onClick={() => setStep(index)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (step + 1) % workflow.length
                  : event.key === "ArrowLeft"
                    ? (step + workflow.length - 1) % workflow.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? workflow.length - 1
                        : null;
              if (next === null) return;
              event.preventDefault();
              setStep(next);
              document.getElementById(`about-step-${next}`)?.focus();
            }}
            sx={{
              p: { xs: 1, sm: 1.5 },
              borderRadius: "12px",
              bgcolor:
                step === index
                  ? "color-mix(in srgb, var(--mui-palette-primary-main) 10%, transparent)"
                  : "transparent",
              color: step === index ? "primary.main" : "text.secondary",
              borderBottom: 2,
              borderColor: step === index ? "primary.main" : "divider",
              transition: "background-color 200ms ease, border-color 200ms ease",
              gap: 1,
              flexDirection: { xs: "column", sm: "row" },
            }}
          >
            <Typography variant="caption">0{index + 1}</Typography>
            <Typography sx={{ fontWeight: 650 }}>{item.title}</Typography>
          </ButtonBase>
        ))}
      </Box>
      <Box
        role="tabpanel"
        id="about-step-content"
        aria-labelledby={`about-step-${step}`}
        sx={{ minHeight: { xs: 126, sm: 92 } }}
      >
        <Stack
          key={step}
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            animation: aboutContentMotion,
            justifyContent: "space-between",
            alignItems: { sm: "center" },
          }}
        >
          <Typography color="text.secondary" sx={{ lineHeight: 1.8, maxWidth: 560 }}>
            {current.detail}
          </Typography>
          <Button
            component={RouterLink}
            to={current.path}
            endIcon={<ArrowOutwardOutlined />}
            sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}
          >
            {current.action}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}

export function AboutRepository({ compact = false }: { compact?: boolean }) {
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(repositoryUrl);
      setCopied(true);
      setNotice("开源地址已复制");
    } catch {
      setNotice("复制失败，请通过链接查看或手动复制地址。");
    }
  }
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: "22px",
        p: { xs: 2.5, sm: compact ? 3 : 4 },
        bgcolor:
          "color-mix(in srgb, var(--mui-palette-primary-main) 4%, var(--mui-palette-background-paper))",
        overflow: "hidden",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={3}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Stack spacing={1}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <GitHub sx={{ fontSize: 30 }} />
            <Typography component="h2" variant="h5">
              一起，让面板更好用
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>
            查看源码、反馈问题，或参与项目的下一次改进。
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            github.com/ee268/MizukiPanel
          </Typography>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}
        >
          <Button
            component="a"
            href={repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            endIcon={<ArrowOutwardOutlined />}
            sx={{
              "& .MuiButton-endIcon": { transition: "transform 200ms ease" },
              "&:hover .MuiButton-endIcon": { transform: "translate(2px, -2px)" },
            }}
          >
            访问 GitHub
          </Button>
          <Tooltip title={copied ? "再次复制地址" : "复制开源地址"}>
            <IconButton aria-label="复制开源地址" onClick={() => void copy()}>
              {copied ? <CheckOutlined color="success" /> : <ContentCopyOutlined />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={3000}
        message={notice}
        onClose={() => setNotice("")}
      />
    </Paper>
  );
}
