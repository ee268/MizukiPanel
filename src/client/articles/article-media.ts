import type { MediaItem } from "../types";
import { mediaPathParts } from "../../lib/articles/media-preview-url";
import { encodeMediaPath } from "../../shared/media-settings";
export { mediaPreviewUrl, validImageReference } from "../../lib/articles/media-preview-url";

function articleDirectory(articleId: string): string[] {
  const parts = mediaPathParts(articleId);
  return parts.slice(0, -1);
}

export function articleMediaReference(articleId: string, item: MediaItem): string {
  if (item.scope === "public") {
    return `/images/${encodeMediaPath(item.path.replaceAll("\\", "/"))}`;
  }

  const directory = articleDirectory(articleId);
  const file = mediaPathParts(item.path);
  let shared = 0;
  while (shared < directory.length && shared < file.length && directory[shared] === file[shared]) {
    shared++;
  }

  const relative = [...directory.slice(shared).map(() => ".."), ...file.slice(shared)].join("/");
  return relative.startsWith("..") ? encodeMediaPath(relative) : `./${encodeMediaPath(relative)}`;
}
