import VerticalAlignTopOutlined from "@mui/icons-material/VerticalAlignTopOutlined";
import { Fab, Portal, Tooltip, Zoom } from "@mui/material";
import { useEffect, useState, type RefObject } from "react";

const scrollRegions =
  ".vditor-content, .vditor-ir, .vditor-wysiwyg, .vditor-sv, .vditor-preview, .vditor-reset";

export function ArticleBackToTop({ contentRef }: { contentRef: RefObject<HTMLDivElement | null> }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const fullscreen = content.querySelector(".vditor--fullscreen");
      setVisible(
        fullscreen
          ? Array.from(fullscreen.querySelectorAll(scrollRegions)).some(
              (region) => region.scrollTop > 240,
            )
          : window.scrollY > 240,
      );
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    content.addEventListener("scroll", schedule, { capture: true, passive: true });
    const observer = new MutationObserver(schedule);
    observer.observe(content, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    update();
    return () => {
      window.removeEventListener("scroll", schedule);
      content.removeEventListener("scroll", schedule, true);
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [contentRef]);

  function scrollToTop() {
    const fullscreen = contentRef.current?.querySelector(".vditor--fullscreen");
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth";
    if (fullscreen) {
      fullscreen
        .querySelectorAll(scrollRegions)
        .forEach((region) => region.scrollTo({ top: 0, behavior }));
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  }

  return (
    <Portal>
      <Zoom in={visible} unmountOnExit>
        <Tooltip title="返回顶部">
          <Fab
            size="small"
            color="primary"
            aria-label="返回顶部"
            onClick={scrollToTop}
            sx={{
              position: "fixed",
              right: { xs: 16, sm: 24 },
              bottom: "calc(24px + env(safe-area-inset-bottom))",
              zIndex: (theme) => theme.zIndex.drawer + 3,
            }}
          >
            <VerticalAlignTopOutlined />
          </Fab>
        </Tooltip>
      </Zoom>
    </Portal>
  );
}
