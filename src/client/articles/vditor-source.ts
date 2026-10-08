import { splitArticleSource } from "../../lib/articles/article-source";
import { mediaPreviewUrl } from "../../lib/articles/media-preview-url";

export function vditorBody(source: string): string {
  return (splitArticleSource(source)?.body ?? source).replace(/\r\n?/g, "\n");
}

/** Keep the complete Frontmatter slice and the article's original newline convention. */
export function replaceVditorBody(source: string, markdown: string): string {
  const parts = splitArticleSource(source);
  const body = markdown.replace(/\r\n?/g, "\n");
  if (!parts) return body;
  return (
    source.slice(0, parts.bodyStart) +
    (parts.newline === "\r\n" ? body.replaceAll("\n", "\r\n") : body)
  );
}

export function vditorImageMarkdown(alt: string, src: string): string {
  return `![${alt.replace(/([\\\[\]])/g, "\\$1").replace(/[\r\n]+/g, " ")}](${src.replaceAll(" ", "%20").replaceAll("(", "%28").replaceAll(")", "%29")})`;
}

export function vditorImagePreviewUrl(articleId: string, reference: string): string | null {
  let path = reference;
  if (!/^https?:\/\//i.test(path)) {
    try {
      path = decodeURIComponent(path);
    } catch {
      /* A literal percent sign may be part of a filename. */
    }
  }
  return mediaPreviewUrl(articleId, path);
}
