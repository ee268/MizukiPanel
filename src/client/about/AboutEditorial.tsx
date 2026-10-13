import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Divider,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import { AboutBrand, AboutFeatureCard, AboutRepository, AboutWorkflow } from "./AboutSections";
import { AboutReveal } from "./AboutMotion";
import { capabilities, questions } from "./content";

const chapters = [
  { id: "about-story", name: "面板的初衷" },
  { id: "about-tools", name: "创作的工具" },
  { id: "about-questions", name: "你可能想知道" },
  { id: "about-source", name: "参与项目" },
];

export function AboutEditorial() {
  const [expanded, setExpanded] = useState<string | false>(questions[0].title);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "190px minmax(0, 1fr)" },
        gap: { xs: 3, md: 5 },
        alignItems: "start",
      }}
    >
      <Box
        component="nav"
        aria-label="关于页章节"
        sx={{
          position: { md: "sticky" },
          top: "calc(var(--mizuki-panel-header-height, 65px) + 24px)",
          display: "flex",
          flexDirection: { xs: "row", md: "column" },
          gap: 1,
          flexWrap: "wrap",
          borderLeft: { md: 1 },
          borderColor: "divider",
          pl: { md: 2 },
        }}
      >
        {chapters.map((chapter, index) => (
          <Button
            component="a"
            href={`#${chapter.id}`}
            onClick={(event) => {
              event.preventDefault();
              document
                .getElementById(chapter.id)
                ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
            }}
            key={chapter.id}
            sx={{
              justifyContent: "flex-start",
              color: "text.secondary",
              px: 1,
              py: 1.5,
              gap: 1.5,
              "&:hover": { color: "primary.main", transform: "translateX(3px)" },
              transition: "transform 200ms ease, color 200ms ease",
            }}
          >
            <Typography variant="caption" color="primary">
              0{index + 1}
            </Typography>
            {chapter.name}
          </Button>
        ))}
      </Box>
      <Stack
        spacing={5}
        sx={{
          minWidth: 0,
          "& section[id]": {
            scrollMarginTop: "calc(var(--mizuki-panel-header-height, 65px) + 24px)",
          },
        }}
      >
        <Box component="section" id="about-story">
          <Typography variant="overline" color="primary">
            ABOUT / MIZUKIPANEL
          </Typography>
          <Typography
            component="h1"
            sx={{ fontSize: { xs: 34, md: 48 }, fontWeight: 750, lineHeight: 1.4, mt: 1, mb: 3 }}
          >
            给创作一个
            <br />
            井然有序的空间。
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: "center" }}>
            <Typography
              color="text.secondary"
              sx={{ fontSize: { xs: 16, md: 18 }, lineHeight: 2, flex: 1 }}
            >
              写一篇文章，还会遇到图片、配置、预览和版本记录。MizukiPanel
              将这些环节连接起来，让你在本地管理自己的 Mizuki 博客，保留熟悉的项目结构与工作方式。
            </Typography>
            <AboutBrand />
          </Stack>
          <Divider sx={{ mt: 4 }} />
        </Box>
        <AboutReveal>
          <Box component="section" id="about-tools">
            <Typography variant="overline" color="primary">
              01 / TOOLKIT
            </Typography>
            <Typography component="h2" variant="h5" sx={{ mt: 1, mb: 2.5 }}>
              从创作，到整理，再到记录
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                gap: 2,
              }}
            >
              {capabilities.map((feature) => (
                <AboutFeatureCard key={feature.id} feature={feature} numbered />
              ))}
            </Box>
          </Box>
        </AboutReveal>
        <AboutReveal>
          <AboutWorkflow />
        </AboutReveal>
        <AboutReveal>
          <Box component="section" id="about-questions">
            <Typography variant="overline" color="primary">
              02 / NOTES
            </Typography>
            <Typography component="h2" variant="h5" sx={{ mt: 1, mb: 2.5 }}>
              你可能想知道
            </Typography>
            {questions.map((question, index) => (
              <Accordion
                key={question.title}
                expanded={expanded === question.title}
                onChange={(_, open) => setExpanded(open ? question.title : false)}
                disableGutters
                variant="outlined"
                sx={{
                  borderRadius: "14px !important",
                  mb: 1.5,
                  "&::before": { display: "none" },
                  boxShadow: "none",
                  overflow: "hidden",
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreOutlined />}
                  id={`about-question-${index}`}
                  aria-controls={`about-answer-${index}`}
                  sx={{ minHeight: 70 }}
                >
                  <Typography sx={{ fontWeight: 650 }}>{question.title}</Typography>
                </AccordionSummary>
                <AccordionDetails id={`about-answer-${index}`} sx={{ pt: 0, pb: 3 }}>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.9 }}>
                    {question.body}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </AboutReveal>
        <AboutReveal>
          <Box component="section" id="about-source">
            <AboutRepository compact />
          </Box>
        </AboutReveal>
      </Stack>
    </Box>
  );
}
