export interface ProjectImage {
  scope: "project";
  path: string;
  folder: string;
  relativePath: string;
  size: number;
  modified: string;
  reference: string;
  publicReference: boolean;
  referencedBy: string[];
}
export interface ImageFolder {
  path: string;
  relativePath: string;
  count: number;
}
export const imageExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".ico",
  ".bmp",
  ".tif",
  ".tiff",
  ".apng",
  ".heic",
  ".heif",
  ".jxl",
]);
export const excludedImageDirectories = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "build-server",
  "out",
  "coverage",
  "target",
  ".astro",
  ".vite",
  ".cache",
  ".local",
  ".output",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".vercel",
  ".netlify",
  "__pycache__",
  ".pnpm-store",
  ".pnpm",
  ".yarn",
  ".npm",
  ".bun",
  ".turbo",
  ".parcel-cache",
  ".venv",
]);
export function matchesProjectImage(item: Pick<ProjectImage, "path">, query: string): boolean {
  return item.path
    .replaceAll("\\", "/")
    .toLowerCase()
    .includes(query.trim().replaceAll("\\", "/").toLowerCase());
}
export function validMediaStorageFolder(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 1024 || /[\x00-\x1f<>"|?*]/.test(value))
    return false;
  return value === "" || /^(?:[a-z]:[\\/]|\/|\\\\)/i.test(value);
}
