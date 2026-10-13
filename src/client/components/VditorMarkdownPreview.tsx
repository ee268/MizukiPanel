import { useEffect, useRef, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { loadVditorRuntime } from "../articles/vditor-runtime";
import "vditor/dist/index.css";

/** Vditor renders Markdown only: no editor, input handlers or editable source nodes. */
export function VditorMarkdownPreview({ markdown }: { markdown: string }) {
  const theme = useTheme();
  const accent =
    theme.palette.mode === "dark"
      ? `color-mix(in srgb, ${theme.palette.primary.main} 65%, white)`
      : theme.palette.primary.main;
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const target = host.current;
    if (!target) return;
    let disposed = false;
    setError(false);
    target.textContent = markdown;
    target.setAttribute("aria-busy", "true");
    void (async () => {
      try {
        const [, { default: Vditor }] = await Promise.all([loadVditorRuntime(), import("vditor")]);
        const html = await Vditor.md2html(markdown, {
          cdn: "/assets/vditor",
          mode: theme.palette.mode,
          markdown: {
            sanitize: true,
            autoSpace: false,
            fixTermTypo: false,
            codeBlockPreview: false,
          },
        });
        if (disposed) return;
        const document = new DOMParser().parseFromString(html, "text/html");
        // Replies are readable content; remove interactive HTML even when allowed by the parser.
        document
          .querySelectorAll(
            "script,style,iframe,object,embed,form,textarea,button,select,link,meta,base,svg",
          )
          .forEach((element) => element.remove());
        for (const element of document.body.querySelectorAll("*")) {
          for (const attribute of [...element.attributes]) {
            if (
              /^on/i.test(attribute.name) ||
              [
                "style",
                "srcdoc",
                "contenteditable",
                "autofocus",
                "tabindex",
                "id",
                "name",
              ].includes(attribute.name)
            )
              element.removeAttribute(attribute.name);
          }
          if (element instanceof HTMLInputElement) {
            if (element.type !== "checkbox") {
              element.remove();
              continue;
            }
            element.disabled = true;
          }
          for (const attribute of ["href", "src", "xlink:href"]) {
            const value = element.getAttribute(attribute);
            if (value === null) continue;
            try {
              const url = new URL(value, window.location.href);
              if (
                !["http:", "https:", ...(attribute === "href" ? ["mailto:"] : [])].includes(
                  url.protocol,
                )
              )
                element.removeAttribute(attribute);
            } catch {
              element.removeAttribute(attribute);
            }
          }
          if (element instanceof HTMLAnchorElement) {
            if (!element.hasAttribute("href")) {
              element.replaceWith(...element.childNodes);
              continue;
            }
            element.target = "_blank";
            element.rel = "noopener noreferrer";
          }
          if (element instanceof HTMLImageElement) {
            element.loading = "lazy";
            element.referrerPolicy = "no-referrer";
          }
        }
        const rendered = window.document.createElement("div");
        rendered.className = "vditor-reset";
        rendered.append(...document.body.childNodes);
        target.replaceChildren(rendered);
        Vditor.highlightRender(
          { enable: true, style: theme.palette.mode === "dark" ? "github-dark" : "github" },
          rendered,
          "/assets/vditor",
        );
        Vditor.mathRender(rendered, { cdn: "/assets/vditor", math: { engine: "KaTeX" } });
      } catch {
        if (!disposed) {
          target.textContent = markdown;
          setError(true);
        }
      } finally {
        if (!disposed) target.removeAttribute("aria-busy");
      }
    })();
    return () => {
      disposed = true;
    };
  }, [markdown, theme.palette.mode]);
  return (
    <>
      <Box
        ref={host}
        className="ai-markdown-preview"
        sx={{
          minWidth: 0,
          maxWidth: "100%",
          overflowWrap: "anywhere",
          whiteSpace: "pre-wrap",
          "& .vditor-reset": {
            p: 0,
            color: "text.primary",
            fontFamily: "var(--mizuki-panel-font-sans)",
            fontSize: "inherit",
            lineHeight: 1.65,
            whiteSpace: "normal",
            overflowWrap: "anywhere",
            "& > :first-child": { mt: 0 },
            "& > :last-child": { mb: 0 },
            "& :is(p,ul,ol,blockquote,pre,table)": { mb: 1.5 },
            "& :is(h1,h2,h3,h4,h5,h6)": {
              mt: 2,
              mb: 1,
              pb: 0,
              border: 0,
              fontWeight: 700,
              lineHeight: 1.35,
            },
            "& h1": { fontSize: "1.4em" },
            "& h2": { fontSize: "1.25em" },
            "& h3": { fontSize: "1.1em" },
            "& :is(strong,b)": {
              color: theme.palette.mode === "dark" ? "common.white" : "text.primary",
            },
            "& a": {
              color: accent,
              textDecoration: "underline dashed",
              textUnderlineOffset: "0.2em",
            },
            "& :is(ul,ol)": { pl: 2.5 },
            "& li + li": { mt: 0.5 },
            "& blockquote": { color: "text.secondary", borderColor: "divider", pl: 1.5 },
            "& :not(pre) > code": {
              fontFamily: "inherit",
              color: accent,
              bgcolor: `color-mix(in srgb, ${theme.palette.primary.main} ${theme.palette.mode === "dark" ? 16 : 8}%, transparent)`,
              borderRadius: 0.5,
              px: 0.5,
              py: 0.15,
              whiteSpace: "break-spaces",
            },
            "& pre": {
              p: 1.25,
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "background.default",
              maxWidth: "100%",
              overflowX: "auto",
              whiteSpace: "pre",
            },
            "& pre > code": {
              fontFamily: "var(--mizuki-panel-font-mono)",
              fontSize: "0.92em",
              bgcolor: "transparent",
              p: 0,
              whiteSpace: "pre",
              overflowWrap: "normal",
            },
            "& table": {
              display: "block",
              maxWidth: "100%",
              overflowX: "auto",
              borderCollapse: "collapse",
            },
            "& :is(th,td)": { borderColor: "divider", px: 1, py: 0.75 },
            "& table tr, & table tr:nth-child(2n)": { bgcolor: "transparent" },
            "& th": { bgcolor: "action.hover" },
            "& img": { maxWidth: "100%", height: "auto", borderRadius: 1 },
            "& hr": { bgcolor: "divider", border: 0, height: "1px" },
          },
        }}
      />
      {error && (
        <Typography variant="caption" color="text.secondary">
          Markdown 暂未渲染，已显示原文。
        </Typography>
      )}
    </>
  );
}
