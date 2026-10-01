export function validLinkReference(value: string): boolean {
  const href = value.trim();
  if (!href || /[\x00-\x1f]/.test(href) || href.startsWith("//")) {
    return false;
  }

  if (/^(https?:|mailto:)/i.test(href)) {
    try {
      const url = new URL(href);
      return url.protocol === "mailto:" ? Boolean(url.pathname) : Boolean(url.hostname);
    } catch {
      return false;
    }
  }

  return !/^[a-z][a-z\d+.-]*:/i.test(href);
}
