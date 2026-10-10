export interface PreviewSettings {
  port: number;
  path: string;
}
export interface PublishSettings {
  remember: boolean;
  type: string;
  scope: string;
}
export interface LogRetention {
  preview: number;
  publish: number;
}
export const commitTypes = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
] as const;
export function validCommitScope(value: unknown): boolean {
  return (
    typeof value === "string" && value.length <= 80 && /^(?:[a-z0-9][a-z0-9._/-]*)?$/.test(value)
  );
}
export function validPreviewPath(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.length > 2048
  )
    return false;
  try {
    const decoded = decodeURIComponent(value);
    return (
      !/[\\\x00-\x20\x7f]/.test(value) &&
      !/[\\\x00-\x1f\x7f]/.test(decoded) &&
      !decoded.startsWith("//") &&
      !decoded
        .split(/[?#]/, 1)[0]
        .split("/")
        .some((part) => part === "." || part === "..")
    );
  } catch {
    return false;
  }
}
export function commitPrefix(type: string, scope: string): string {
  return `${type}${scope ? `(${scope})` : ""}: `;
}
