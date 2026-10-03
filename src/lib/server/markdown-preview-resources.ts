import { mediaPreviewUrl } from "../articles/media-preview-url";

interface HtmlNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HtmlNode[];
}

function visit(node: HtmlNode, articleId: string): void {
  if (node.type === "element" && node.tagName === "img" && node.properties) {
    const reference = node.properties.src;
    if (typeof reference === "string") {
      node.properties.src = mediaPreviewUrl(articleId, reference) ?? "";
      delete node.properties.srcSet;
      delete node.properties.srcset;
      delete node.properties.sizes;
    }
  }
  for (const child of node.children ?? []) visit(child, articleId);
}

/** Rewrite images through the existing guarded media route in either content mode. */
export function rehypePreviewResources(options: { articleId: string }) {
  return (tree: HtmlNode) => visit(tree, options.articleId);
}
