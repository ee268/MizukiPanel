function mediaUrl(scope: "public" | "article", path: string): string {
  return `/api/media/file?scope=${scope}&path=${encodeURIComponent(path)}`;
}

function resolveArticlePath(articleId: string, image: string): string | null {
  const segments = articleId.replace(/\\/g, "/").split("/").slice(0, -1);

  for (const segment of image.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (!segments.length) {
        return null;
      }
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.length ? segments.join("/") : null;
}

export function articleImageUrl(image: string, articleId: string): string | null {
  const value = image.trim();
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^\/?images\//i.test(value)) {
    const publicPath = value.replace(/^\/?images\//i, "");
    return publicPath ? mediaUrl("public", publicPath) : null;
  }

  if (value.startsWith("/")) {
    return null;
  }

  const articlePath = resolveArticlePath(articleId, value);
  return articlePath ? mediaUrl("article", articlePath) : null;
}
