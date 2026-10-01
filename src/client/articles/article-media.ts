import type { MediaItem } from "../types";

function pathParts(value: string): string[] {
  return value.replaceAll("\\", "/").split("/").filter(Boolean);
}

function normalizeRelativePath(value: string): string | null {
  const parts: string[] = [];
  for (const part of pathParts(value)) {
    if (part === ".") {
      continue;
    }
    if (part === "..") {
      if (!parts.length) {
        return null;
      }
      parts.pop();
      continue;
    }
    if (/[:\x00-\x1f]/.test(part)) {
      return null;
    }
    parts.push(part);
  }
  return parts.length ? parts.join("/") : null;
}

function articleDirectory(articleId: string): string[] {
  const parts = pathParts(articleId);
  return parts.slice(0, -1);
}

export function articleMediaReference(articleId: string, item: MediaItem): string {
  if (item.scope === "public") {
    return `/images/${item.path.replaceAll("\\", "/")}`;
  }

  const directory = articleDirectory(articleId);
  const file = pathParts(item.path);
  let shared = 0;
  while (shared < directory.length && shared < file.length && directory[shared] === file[shared]) {
    shared++;
  }

  const relative = [...directory.slice(shared).map(() => ".."), ...file.slice(shared)].join("/");
  return relative.startsWith("..") ? relative : `./${relative}`;
}

export function validImageReference(value: string): boolean {
  const reference = value.trim();
  if (!reference || /[\\\x00-\x1f]/.test(reference)) {
    return false;
  }

  if (/^https?:\/\//i.test(reference)) {
    try {
      return Boolean(new URL(reference).hostname);
    } catch {
      return false;
    }
  }

  if (reference.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(reference)) {
    return false;
  }

  return reference.startsWith("/images/") || !reference.startsWith("/");
}

export function mediaPreviewUrl(articleId: string, reference: string): string | null {
  if (!validImageReference(reference)) {
    return null;
  }

  if (/^https?:\/\//i.test(reference)) {
    return reference;
  }

  if (reference.startsWith("/images/")) {
    const raw = reference.slice("/images/".length).split(/[?#]/, 1)[0];
    const path = normalizeRelativePath(raw);
    return path ? `/api/media/file?scope=public&path=${encodeURIComponent(path)}` : null;
  }

  const raw = reference.split(/[?#]/, 1)[0];
  const directory = articleDirectory(articleId).join("/");
  const path = normalizeRelativePath(`${directory}/${raw}`);
  return path ? `/api/media/file?scope=article&path=${encodeURIComponent(path)}` : null;
}
