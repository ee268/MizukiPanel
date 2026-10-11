import path from "node:path";
import { excludedImageDirectories } from "../../shared/project-media";
import { encodeMediaPath } from "../../shared/media-settings";
import type { ProjectReport } from "./project";

export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaError";
  }
}
export function mediaProjectRoots(report: ProjectReport): string[] {
  return [
    ...new Set([
      report.root,
      ...(report.mode === "external" && report.contentRoot ? [report.contentRoot] : []),
    ]),
  ].sort((a, b) => b.length - a.length);
}
export function projectMediaTarget(report: ProjectReport, absolutePath: string) {
  if (!absolutePath || absolutePath !== absolutePath.trim() || !path.isAbsolute(absolutePath))
    throw new MediaError("存储位置必须是当前项目内的绝对路径。");
  if (absolutePath.split(/[\\/]+/).some((part) => part === ".."))
    throw new MediaError("图片路径不能包含 ..。");
  const absolute = path.resolve(absolutePath);
  for (const root of mediaProjectRoots(report)) {
    const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
    if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) continue;
    if (relative.split("/").some((part) => excludedImageDirectories.has(part.toLowerCase())))
      throw new MediaError("不能使用构建、依赖或面板状态目录存储图片。");
    const external = root === report.contentRoot;
    const webPath =
      external && relative.startsWith("images/")
        ? relative
        : !external && relative.startsWith("public/")
          ? relative.slice(7)
          : null;
    return {
      root,
      relative,
      absolute,
      article: undefined,
      publicReference: webPath !== null,
      reference: webPath !== null ? `/${encodeMediaPath(webPath)}` : absolute,
    };
  }
  throw new MediaError("存储位置必须位于当前 Mizuki 项目或已连接的内容仓库内。");
}
export function defaultMediaStorageFolder(
  report: ProjectReport,
  values: { storageFolder?: string; folder?: string; scope?: string },
) {
  if (values.storageFolder) return projectMediaTarget(report, values.storageFolder).absolute;
  const root = report.contentRoot ?? report.root;
  return path.resolve(
    root,
    report.mode === "external" ? "images" : "public/images",
    values.scope !== "article" ? values.folder || "" : "",
  );
}
