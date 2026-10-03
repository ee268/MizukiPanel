import type { EditorFontMode } from "../../lib/server/editor-fonts";

export interface MarkdownPreviewResult {
  html: string;
  css: string;
  hue: number;
  differences: string[];
  milliseconds: number;
}

const customFonts = `
  @font-face { font-family: MizukiEditorBody; src: url('/api/editor-fonts/body') format('woff2'); font-weight: 500; font-display: swap; }
  @font-face { font-family: MizukiEditorCjk; src: url('/api/editor-fonts/cjk') format('woff2'); font-weight: 400; font-display: swap; }
  @font-face { font-family: MizukiEditorCode; src: url('/api/editor-fonts/code') format('woff2'); font-weight: 400; font-display: swap; }
  body { font-family: MizukiEditorBody, MizukiEditorCjk, ui-sans-serif, system-ui, sans-serif; }
  .custom-md :is(code, pre, .mermaid) { font-family: MizukiEditorCode, "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
`;

const baseCss = `
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; padding: 28px; background: var(--page); color: var(--text); font: 16px/1.8 ui-sans-serif, system-ui, sans-serif; }
  .custom-md { max-width: 760px; margin: 0 auto; overflow-wrap: anywhere; }
  .custom-md :is(h1,h2,h3,h4,h5,h6) { color: var(--heading); line-height: 1.35; margin: 1.6em 0 .65em; }
  .custom-md h1 { font-size: 1.875rem; } .custom-md h2 { font-size: 1.5rem; } .custom-md h3 { font-size: 1.25rem; }
  .custom-md :is(h1,h2,h3,h4,h5,h6) .anchor { opacity: 0; margin-inline-start: .2ch; text-decoration: none; transition: opacity 150ms; }
  .custom-md :is(h1,h2,h3,h4,h5,h6):hover .anchor,
  .custom-md :is(h1,h2,h3,h4,h5,h6) .anchor:focus-visible { opacity: 1; }
  .custom-md p, .custom-md ul, .custom-md ol { margin: .9em 0; }
  .custom-md a { color: var(--primary); }
  .custom-md img { max-width: 100%; height: auto; border-radius: 8px; }
  .custom-md pre { overflow-x: auto; padding: 16px; border-radius: 10px; background: var(--code-bg); line-height: 1.55; }
  .custom-md :not(pre) > code { background: var(--inline-code-bg); padding: .12em .3em; border-radius: 4px; }
  .custom-md blockquote { border-inline-start: 4px solid var(--primary); margin: 1.2em 0; padding: .15em 1em; background: var(--surface); }
  .custom-md table { border-collapse: collapse; width: 100%; display: block; overflow-x: auto; }
  .custom-md .table-wrapper { max-width: 100%; overflow-x: auto; }
  .custom-md th, .custom-md td { border: 1px solid var(--line); padding: .45em .7em; }
  .custom-md th { background: var(--surface); }
  .custom-md .image-grid { display: grid; grid-template-columns: repeat(var(--image-grid-columns, 3), minmax(0, 1fr)); gap: .75rem; margin: 1.5rem 0; }
  .custom-md .image-grid__item { display: flex; flex-direction: column; min-width: 0; margin: 0; }
  .custom-md .image-grid__link { display: block; aspect-ratio: var(--image-grid-aspect-ratio, 16 / 10); overflow: hidden; border-radius: 8px; background: var(--surface); line-height: 0; }
  .custom-md .image-grid__link > img { display: block; width: 100%; height: 100%; max-width: none; margin: 0; object-fit: var(--image-grid-fit, cover); border-radius: 0; }
  .custom-md .image-grid__caption { margin-top: auto; padding-top: .45rem; color: var(--text); font-size: .875rem; text-align: center; }
  @media (max-width: 767px) { .custom-md .image-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .custom-md .image-grid[data-columns="1"] { grid-template-columns: 1fr; } }
  @media (max-width: 479px) { .custom-md .image-grid { grid-template-columns: 1fr; } }
  .custom-md hr { border: 0; border-top: 1px solid var(--line); margin: 2em 0; }
  .custom-md .mermaid { white-space: pre-wrap; font-family: monospace; }
`;

function safeStyle(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}

export function markdownPreviewDocument(
  result: MarkdownPreviewResult,
  mode: "light" | "dark",
  katexCssUrl: string,
  fontMode: EditorFontMode = "system",
): string {
  const dark = mode === "dark";
  const hue = Number.isFinite(result.hue) ? Math.min(360, Math.max(0, result.hue)) : 240;
  const variables = `
    :root { color-scheme: ${mode}; --page: ${dark ? "#111318" : "#fff"};
      --surface: ${dark ? "#1b1e26" : "#f5f6fa"}; --text: ${dark ? "#e7e9ef" : "#242833"};
      --heading: ${dark ? "#fff" : "#171b24"}; --line: ${dark ? "#3c414d" : "#d9dce4"};
      --code-bg: ${dark ? "#0d1119" : "#f2f4f8"}; --inline-code-bg: ${dark ? "#303542" : "#e9edf5"};
      --primary: hsl(${hue} 75% ${dark ? "70" : "42"}%);
      --tw-prose-body: var(--text); --tw-prose-headings: var(--heading);
      --admonitions-color-note: #448aff; --admonitions-color-tip: #00bfa5;
      --admonitions-color-important: #a855f7; --admonitions-color-warning: #f59e0b;
      --admonitions-color-caution: #ef4444;
    }
  `;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">
<link rel="stylesheet" href="${katexCssUrl}"><style>${safeStyle(variables + baseCss + result.css + (fontMode === "custom" ? customFonts : ""))}</style></head>
<body><article class="custom-md">${result.html}</article></body></html>`;
}
