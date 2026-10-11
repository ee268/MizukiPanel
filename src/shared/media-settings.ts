export interface MediaSettings {
  storageFolder: string;
  scope: "public" | "article";
  folder: string;
  naming: "original" | "date" | "unique";
  referenceFormat: "auto" | "markdown" | "html";
  alt: "filename" | "empty";
  compress: boolean;
  quality: number;
  resize: boolean;
  maxDimension: number;
  format: "original" | "png" | "jpeg" | "webp" | "avif";
}
export function validMediaFolder(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.length <= 240 &&
    (value === "" ||
      value
        .split("/")
        .every(
          (part) =>
            Boolean(part) &&
            !part.startsWith(".") &&
            !/[\\<>:"|?*\x00-\x1f]/.test(part) &&
            !/[. ]$/.test(part) &&
            !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(part),
        ))
  );
}
export function mediaAlt(filename: string, policy: MediaSettings["alt"]): string {
  return policy === "empty"
    ? ""
    : (filename
        .replaceAll("\\", "/")
        .split("/")
        .at(-1)
        ?.replace(/\.[^.]+$/, "") ?? "");
}
export const encodeMediaPath = (value: string): string =>
  value.split("/").map(encodeURIComponent).join("/");
const attribute = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/[\r\n]+/g, " ");
export function imageReference(
  reference: string,
  alt: string,
  format: "path" | "markdown" | "html",
): string {
  if (format === "path") return reference;
  if (format === "html") return `<img src="${attribute(reference)}" alt="${attribute(alt)}" />`;
  return `![${alt.replace(/([\\\[\]])/g, "\\$1").replace(/[\r\n]+/g, " ")}](${reference.replaceAll(" ", "%20").replaceAll("(", "%28").replaceAll(")", "%29")})`;
}
export interface MediaPreparation {
  publicReference?: boolean;
  token: string;
  expiresAt: string;
  originalName: string;
  originalSize: number;
  originalPath: string;
  processedSize: number | null;
  processedPath: string | null;
  originalReference: string;
  processedReference: string | null;
  width: number | null;
  height: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  status: "original" | "processed" | "skipped" | "failed";
  message: string;
  alt: string;
  referenceFormat: MediaSettings["referenceFormat"];
  originalAvailable: boolean;
  processedAvailable: boolean;
}
