import { splitArticleSource } from "../../lib/articles/article-source";

/** Repair only the metadata; keep the body, BOM and newline convention intact. */
export function replaceFrontmatterYaml(source: string, yaml: string): string {
  const parts = splitArticleSource(source);
  const newline = parts?.newline ?? (source.includes("\r\n") ? "\r\n" : "\n");
  const content = yaml.replace(/\r\n|\r|\n/g, newline);
  if (parts) return parts.opening + content + newline + parts.closing + parts.body;
  const bom = source.startsWith("\uFEFF") ? "\uFEFF" : "";
  return `${bom}---${newline}${content}${newline}---${newline}${source.slice(bom.length)}`;
}
