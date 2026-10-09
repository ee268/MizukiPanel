import { isMap, parseDocument } from "yaml";
import type { ArticleTemplateSettings } from "./index";

const variables = new Set(["title", "date", "year", "month", "day", "slug"]);
export function expandTemplate(text: string, values: Record<string, string>): string {
  if (/\{\{|\}\}/.test(text.replace(/\{\{([^{}]*)\}\}/g, "")))
    throw new Error("模板占位符必须使用完整的 {{名称}}。");
  const expanded = text.replace(/\{\{([^{}]*)\}\}/g, (_, key: string) => {
    key = key.trim();
    if (!variables.has(key)) throw new Error(`不支持的模板占位符：${key}`);
    return values[key] ?? "";
  });
  return expanded;
}
export function templateDefaults(
  text: string,
  values: Record<string, string>,
): Record<string, unknown> {
  if (!text.trim()) return {};
  const document = parseDocument(text);
  if (document.errors.length || document.warnings.length || !isMap(document.contents))
    throw new Error("默认 Frontmatter 必须是有效的 YAML 字段映射。");
  const input: unknown = document.toJS({ maxAliasCount: 20 });
  JSON.stringify(input); // Reject cyclic aliases rather than recursively expanding them.
  function visit(value: unknown, depth = 0): unknown {
    if (depth > 20) throw new Error("默认字段的嵌套层级过深。");
    if (typeof value === "string") return expandTemplate(value, values);
    if (Array.isArray(value)) return value.map((entry) => visit(entry, depth + 1));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, visit(entry, depth + 1)]),
      );
    return value;
  }
  return visit(input) as Record<string, unknown>;
}
export function validTemplateField(field: keyof ArticleTemplateSettings, value: unknown): boolean {
  if (
    typeof value !== "string" ||
    value.length > (field === "body" ? 100000 : field === "fileName" ? 240 : 16000)
  )
    return false;
  try {
    const sample = {
      title: "示例文章",
      date: "2026-10-09",
      year: "2026",
      month: "10",
      day: "09",
      slug: "example",
    };
    if (field === "frontmatter") templateDefaults(value, sample);
    else {
      const result = expandTemplate(value, sample);
      if (field === "fileName" && result) validatePostPath(result);
    }
    return true;
  } catch {
    return false;
  }
}
export function validatePostPath(input: string): string {
  if (input !== input.trim() || !input || input.includes("\\") || /^[A-Za-z]:/.test(input))
    throw new Error("文章路径必须是 posts 内的相对路径");
  const segments = input.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.startsWith(".") ||
        /[<>:"|?*\x00-\x1f]/.test(segment) ||
        /[. ]$/.test(segment) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment),
    )
  )
    throw new Error("文章路径包含不安全的名称");
  if (!/\.(md|mdx)$/i.test(segments.at(-1)!))
    throw new Error("文章文件必须使用 .md 或 .mdx 扩展名");
  return input;
}
