export interface MarkdownPreviewResult {
  html: string;
  css: string;
  hue: number;
  differences: string[];
  milliseconds: number;
}

const baseCss = `
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; padding: 28px; background: var(--page); color: var(--text); font: 16px/1.8 Inter, "Segoe UI", "Microsoft YaHei", sans-serif; }
  .custom-md { max-width: 900px; margin: 0 auto; overflow-wrap: anywhere; }
  .custom-md :is(h1,h2,h3,h4,h5,h6) { color: var(--heading); line-height: 1.35; margin: 1.6em 0 .65em; }
  .custom-md h1 { font-size: 2rem; } .custom-md h2 { font-size: 1.6rem; } .custom-md h3 { font-size: 1.32rem; }
  .custom-md p, .custom-md ul, .custom-md ol { margin: .9em 0; }
  .custom-md a { color: var(--primary); }
  .custom-md img { max-width: 100%; height: auto; border-radius: 8px; }
  .custom-md pre { overflow-x: auto; padding: 16px; border-radius: 10px; background: var(--code-bg); line-height: 1.55; }
  .custom-md :not(pre) > code { background: var(--inline-code-bg); padding: .12em .3em; border-radius: 4px; }
  .custom-md blockquote { border-inline-start: 4px solid var(--primary); margin: 1.2em 0; padding: .15em 1em; background: var(--surface); }
  .custom-md table { border-collapse: collapse; width: 100%; display: block; overflow-x: auto; }
  .custom-md th, .custom-md td { border: 1px solid var(--line); padding: .45em .7em; }
  .custom-md th { background: var(--surface); }
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
<link rel="stylesheet" href="${katexCssUrl}"><style>${safeStyle(variables + baseCss + result.css)}</style></head>
<body><article class="custom-md">${result.html}</article></body></html>`;
}
