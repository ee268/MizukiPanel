import { isMap, parseDocument } from "yaml";
import { splitArticleSource } from "../articles/article-source";

function seasonFrontmatter(source: string) {
  const parts = splitArticleSource(source);
  if (!parts) throw new Error("季度内容必须包含 YAML Frontmatter");
  const document = parseDocument(parts.yaml, { uniqueKeys: true, strict: true });
  if (document.errors.length) throw new Error(`季度 YAML 无效：${document.errors[0].message}`);
  if (!isMap(document.contents)) throw new Error("季度 YAML 顶层必须是键值对象");
  return { parts, document };
}

export function animeSeasonAuthor(source: string): string {
  try {
    const author = seasonFrontmatter(source).document.get("author");
    return typeof author === "string" ? author.trim() : "";
  } catch {
    // An invalid older file can still be listed and opened for repair.
    return "";
  }
}

export function removeAnimeSeasonFlags(source: string): string {
  const { parts, document } = seasonFrontmatter(source);
  if (!document.has("comments") && !document.has("copyright")) return source;
  document.delete("comments");
  document.delete("copyright");
  const yaml = document.toString({ lineWidth: 0 }).replace(/\n/g, parts.newline);
  return parts.opening + yaml + parts.closing + parts.body;
}
