import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Box, useMediaQuery } from "@mui/material";
import { useLocation } from "react-router-dom";

type Motion = { from?: string; duration: number; delay?: number; stagger?: number };
// Only static regions move. Editors keep their fixed toolbars and overlays in place.
const entrances: Record<string, Record<string, Motion>> = {
  "/": {
    heading: { from: "translateY(8px)", duration: 220 },
    controls: { from: "translateX(-12px)", duration: 280, delay: 35 },
    metric: { from: "translateY(14px)", duration: 300, stagger: 45 },
    chart: { duration: 360, delay: 100 },
  },
  "/articles": {
    heading: { from: "translateX(10px)", duration: 240 },
    controls: { duration: 200, delay: 30 },
    item: { from: "translateY(10px)", duration: 280, stagger: 35 },
    content: { duration: 240 },
  },
  "/config": {
    heading: { duration: 200 },
    controls: { from: "translateY(-8px)", duration: 240, delay: 30 },
  },
  "/features": {
    heading: { from: "translateY(-6px)", duration: 220 },
    controls: { from: "translateY(-8px)", duration: 240, delay: 30 },
  },
  "/media": {
    heading: { duration: 200 },
    controls: { from: "translateY(-8px)", duration: 240 },
    tile: { from: "translateY(8px) scale(.96)", duration: 320, stagger: 30 },
  },
  "/preview": {
    heading: { from: "translateX(-8px)", duration: 220 },
    controls: { from: "translateX(-12px)", duration: 260, delay: 40 },
    logs: { from: "translateY(12px)", duration: 340, delay: 120 },
  },
  "/publish": {
    heading: { duration: 220 },
    step: { from: "translateX(-10px)", duration: 260, stagger: 45 },
    content: { duration: 300, delay: 100 },
    aside: { from: "translateY(10px)", duration: 320, delay: 160 },
  },
  "/settings": {
    heading: { duration: 200 },
    navigation: { from: "translateY(-10px)", duration: 260 },
    content: { duration: 300, delay: 90 },
  },
  "/about": {
    heading: { from: "translateY(12px)", duration: 320 },
    summary: { from: "scale(.985)", duration: 380, delay: 65 },
  },
};

export function PageEntrance({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  useLayoutEffect(() => {
    const container = root.current;
    const motions: Record<string, Motion> | undefined = pathname.startsWith("/features/")
      ? { heading: { from: "translateX(8px)", duration: 240 } }
      : entrances[pathname];
    if (!container || !motions || reducedMotion || !Element.prototype.animate) return;
    const seen = new WeakSet<HTMLElement>();
    const counts = new Map<string, number>();
    const animations: Animation[] = [];
    let timer: number | undefined;
    const enter = () => {
      for (const element of container.querySelectorAll<HTMLElement>("[data-page-motion]")) {
        if (seen.has(element)) continue;
        const role = element.dataset.pageMotion!;
        const motion = motions[role];
        if (!motion) continue;
        const bounds = element.getBoundingClientRect();
        if (!bounds.width || !bounds.height || getComputedStyle(element).visibility === "hidden")
          continue;
        seen.add(element);
        // Below-the-fold regions remain readable without waiting for another animation.
        if (bounds.bottom < 0 || bounds.top > window.innerHeight || animations.length >= 24)
          continue;
        const index = counts.get(role) ?? 0;
        counts.set(role, index + 1);
        const animation = element.animate(
          [
            { opacity: 0, ...(motion.from ? { transform: motion.from } : {}) },
            { opacity: 1, ...(motion.from ? { transform: "none" } : {}) },
          ],
          {
            duration: motion.duration,
            delay: (motion.delay ?? 0) + Math.min(index * (motion.stagger ?? 0), 180),
            easing: "cubic-bezier(.2,.7,.2,1)",
            fill: "backwards",
          },
        );
        animation.id = `mizuki-page:${pathname}:${role}`;
        animations.push(animation);
      }
      if (animations.length && timer === undefined)
        timer = window.setTimeout(() => observer.disconnect(), 4000);
    };
    // Lazy pages and API-backed cards may arrive after the navigation commits.
    const observer = new MutationObserver(enter);
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "aria-busy"],
    });
    enter();
    const stopOnInteraction = (event: Event) => {
      if (event.isTrusted) {
        observer.disconnect();
        animations.forEach((animation) => animation.cancel());
      }
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((event) =>
      window.addEventListener(event, stopOnInteraction, { capture: true, passive: true }),
    );
    const loadingTimer = window.setTimeout(() => observer.disconnect(), 15000);
    return () => {
      clearTimeout(timer);
      clearTimeout(loadingTimer);
      observer.disconnect();
      events.forEach((event) => window.removeEventListener(event, stopOnInteraction, true));
      animations.forEach((animation) => animation.cancel());
    };
  }, [pathname, reducedMotion]);
  return (
    <Box ref={root} data-page-entrance={pathname} sx={{ display: "contents" }}>
      {children}
    </Box>
  );
}
