export type PreviewLogTone = "default" | "muted" | "accent" | "success" | "warning" | "error";

export interface PreviewLogToken {
  text: string;
  tone: PreviewLogTone;
}

export function previewTargetUrl(baseUrl: string, pagePath: string): string {
  if (!baseUrl) return "";
  const path = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
  return baseUrl.replace(/\/$/, "") + path;
}

export function previewLogTone(line: string): PreviewLogTone {
  if (/(?:\berror\b|\bfailed\b|\bfatal\b|失败|异常|错误|✗|×)/i.test(line)) return "error";
  if (/(?:\bwarn(?:ing)?\b|deprecated|警告)/i.test(line)) return "warning";
  if (/(?:\bready\b|\brunning\b|\blistening\b|启动|已连接|✓|✔)/i.test(line)) return "success";
  return "default";
}

export function previewLogTokens(line: string): PreviewLogToken[] {
  const tokens: PreviewLogToken[] = [];
  const timestamp = /^(\[[^\]]+\])(\s*)/.exec(line);
  let rest = line;
  if (timestamp) {
    tokens.push({ text: timestamp[1], tone: "muted" });
    if (timestamp[2]) tokens.push({ text: timestamp[2], tone: "default" });
    rest = line.slice(timestamp[0].length);
  }

  const baseTone = previewLogTone(rest);
  const pattern = /(https?:\/\/[^\s"'\\]+|"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:astro|vite|ready|local|network|watching)\b|\b\d+(?:\.\d+)?\b|[{}[\],:]|[✓✔✗×])/gi;
  let cursor = 0;
  for (const match of rest.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ text: rest.slice(cursor, index), tone: baseTone });
    const value = match[0];
    let tone: PreviewLogTone = "accent";
    if (/^https?:/i.test(value)) tone = "accent";
    else if (/^"(?:\\.|[^"\\])*"$/.test(value)) {
      const following = rest.slice(index + value.length);
      tone = /^\s*:/.test(following) ? "warning" : "accent";
    } else if (/^\d/.test(value)) tone = "warning";
    else if (/^[{}[\],:]$/.test(value)) tone = "muted";
    else if (/[✗×]/.test(value)) tone = "error";
    else if (/[✓✔]|ready/i.test(value)) tone = "success";
    tokens.push({ text: value, tone });
    cursor = index + value.length;
  }
  if (cursor < rest.length) tokens.push({ text: rest.slice(cursor), tone: baseTone });
  return tokens.length ? tokens : [{ text: line, tone: baseTone }];
}
