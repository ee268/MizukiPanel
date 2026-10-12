import { useLayoutEffect, useRef } from "react";
export function useConversationScroll(revision: unknown) {
  const scroll = useRef<HTMLDivElement>(null),
    content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const viewport = scroll.current,
      body = content.current;
    if (!viewport || !body) return;
    let following = true,
      frame = 0;
    const bottom = () => {
      if (following) viewport.scrollTop = viewport.scrollHeight;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(bottom);
    };
    const stop = () => {
      following = false;
    };
    // Difference rows and loading transitions can settle after the reply commit.
    const observer = new ResizeObserver(schedule);
    observer.observe(body);
    observer.observe(viewport);
    viewport.addEventListener("wheel", stop, { passive: true });
    viewport.addEventListener("touchstart", stop, { passive: true });
    viewport.addEventListener("pointerdown", stop);
    viewport.addEventListener("keydown", stop);
    bottom();
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      viewport.removeEventListener("wheel", stop);
      viewport.removeEventListener("touchstart", stop);
      viewport.removeEventListener("pointerdown", stop);
      viewport.removeEventListener("keydown", stop);
    };
  }, [revision]);
  return { scroll, content };
}
