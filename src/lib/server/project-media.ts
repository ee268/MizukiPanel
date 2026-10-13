import { lstat, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import {
  excludedImageDirectories,
  imageExtensions,
  type ImageFolder,
  type ProjectImage,
} from "../../shared/project-media";
import { encodeMediaPath } from "../../shared/media-settings";
import type { ProjectReport } from "./project";
import { assertManagedRealPath } from "./path-guard";
import {
  MediaError,
  defaultMediaStorageFolder,
  mediaProjectRoots,
  projectMediaTarget,
} from "./media-paths";
import { moveToRecycleBin } from "./recycle-bin";
import { defaultStateDir } from "./workspace";

async function outputDirectories(root: string) {
  const directories: string[] = [];
  for (const name of ["astro.config.mjs", "astro.config.ts", "astro.config.js"]) {
    try {
      const source = await readFile(await assertManagedRealPath(root, name), "utf8");
      const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        if (
          ts.isPropertyAssignment(node) &&
          ["outDir", "cacheDir"].includes(node.name.getText(file).replace(/["']/g, "")) &&
          ts.isStringLiteral(node.initializer)
        )
          directories.push(path.resolve(root, node.initializer.text));
        ts.forEachChild(node, visit);
      }
      visit(file);
    } catch {
      /* Optional config: conventional output directories are always excluded. */
    }
  }
  return directories;
}
export async function assertProjectMediaLocation(report: ProjectReport, absolute: string) {
  const target = projectMediaTarget(report, absolute);
  for (const output of await outputDirectories(report.root)) {
    const relative = path.relative(output, target.absolute);
    if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative)))
      throw new MediaError("不能访问或上传到项目的构建输出目录。");
  }
  const filename = target.relative
    ? await assertManagedRealPath(target.root, target.relative)
    : target.root;
  return { ...target, filename };
}

export async function assertProjectMediaDirectory(report: ProjectReport, absolute: string) {
  const target = await assertProjectMediaLocation(report, absolute);
  try {
    if (!(await lstat(target.filename)).isDirectory())
      throw new MediaError("存储位置必须是文件夹，不能是文件。");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return target;
}
export async function scanProjectMedia(report: ProjectReport, references = true) {
  const media: ProjectImage[] = [];
  const warnings: string[] = [];
  const texts: { path: string; source: string }[] = [];
  const outputs = await outputDirectories(report.root);
  const seen = new Set<string>();
  const reads: Array<() => Promise<void>> = [];
  async function walk(current: string) {
    const key = process.platform === "win32" ? current.toLowerCase() : current;
    if (seen.has(key) || outputs.some((output) => path.relative(output, current) === "")) return;
    seen.add(key);
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        warnings.push(`目录无法读取：${current}`);
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!excludedImageDirectories.has(entry.name.toLowerCase())) await walk(absolute);
      } else if (entry.isFile()) {
        const extension = path.extname(entry.name).toLowerCase();
        if (imageExtensions.has(extension)) {
          reads.push(async () => {
            try {
              const target = projectMediaTarget(report, absolute);
              const details = await stat(await assertManagedRealPath(target.root, target.relative));
              media.push({
                scope: "project",
                path: target.absolute,
                folder: path.dirname(target.absolute),
                relativePath: target.relative,
                size: details.size,
                modified: details.mtime.toISOString(),
                reference: target.reference,
                publicReference: target.publicReference,
                referencedBy: [],
              });
            } catch {
              warnings.push(`图片无法读取：${absolute}`);
            }
          });
        } else if (
          references &&
          /\.(md|mdx|ts|tsx|js|mjs|astro|json|ya?ml|css|scss|html|xml)$/i.test(entry.name)
        ) {
          reads.push(async () => {
            try {
              if ((await stat(absolute)).size <= 4 * 1024 * 1024) {
                const target = projectMediaTarget(report, absolute);
                texts.push({
                  path: absolute,
                  source: await readFile(
                    await assertManagedRealPath(target.root, target.relative),
                    "utf8",
                  ),
                });
              } else warnings.push(`引用文件过大，未扫描：${absolute}`);
            } catch {
              warnings.push(`引用文件无法读取：${absolute}`);
            }
          });
        }
      }
    }
  }
  for (const root of mediaProjectRoots(report)) await walk(root);
  for (let start = 0; start < reads.length; start += 8)
    await Promise.all(reads.slice(start, start + 8).map((read) => read()));
  for (const item of media) {
    item.referencedBy = texts
      .filter((text) => {
        const relative = path
          .relative(path.dirname(text.path), item.path)
          .replaceAll(path.sep, "/");
        const candidates = [
          item.path,
          item.relativePath,
          relative,
          encodeMediaPath(relative),
          ...(item.relativePath.startsWith("src/")
            ? [item.relativePath.slice(4), `@/${item.relativePath.slice(4)}`]
            : []),
          ...(item.relativePath.startsWith("src/assets/")
            ? [`@assets/${item.relativePath.slice(11)}`]
            : []),
          ...(item.relativePath.startsWith("src/assets/public/")
            ? [item.relativePath.slice(18)]
            : []),
          ...(item.publicReference ? [item.reference, item.reference.slice(1)] : []),
        ];
        return candidates.some((candidate) => candidate && text.source.includes(candidate));
      })
      .map((text) => path.relative(report.root, text.path).replaceAll(path.sep, "/"))
      .sort();
  }
  const folders = new Map<string, ImageFolder>();
  for (const item of media) {
    const folder = folders.get(item.folder) ?? {
      path: item.folder,
      relativePath: path.dirname(item.relativePath).replaceAll(path.sep, "/"),
      count: 0,
    };
    folder.count++;
    folders.set(item.folder, folder);
  }
  return {
    media: media.sort(
      (a, b) => b.modified.localeCompare(a.modified) || a.path.localeCompare(b.path),
    ),
    folders: [...folders.values()].sort((a, b) => a.path.localeCompare(b.path)),
    warnings,
  };
}
export async function projectMediaFolders(
  report: ProjectReport,
  values: { storageFolder?: string; folder?: string; scope?: string },
  scan?: Awaited<ReturnType<typeof scanProjectMedia>>,
) {
  const scanned = scan ?? (await scanProjectMedia(report, false));
  let defaultFolder: string;
  try {
    defaultFolder = defaultMediaStorageFolder(report, values);
    await assertProjectMediaDirectory(report, defaultFolder);
  } catch {
    defaultFolder = defaultMediaStorageFolder(report, {});
    scanned.warnings.push("默认存储文件夹不可用，已回退到公共图片目录。");
  }
  if (!scanned.folders.some((folder) => folder.path === defaultFolder))
    scanned.folders.unshift({
      path: defaultFolder,
      relativePath: projectMediaTarget(report, defaultFolder).relative,
      count: 0,
    });
  return {
    folders: scanned.folders,
    defaultFolder,
    fallbackFolder: defaultMediaStorageFolder(report, {}),
    warnings: scanned.warnings,
  };
}
export async function deleteProjectImage(
  report: ProjectReport,
  absolute: string,
  stateDir = defaultStateDir(),
) {
  if (report.readOnly) throw new MediaError("当前项目只读，不能删除图片。");
  const scan = await scanProjectMedia(report);
  const item = scan.media.find((item) => item.path === path.resolve(absolute));
  if (!item) throw new MediaError("图片文件不存在。");
  if (scan.warnings.length)
    throw new MediaError("部分目录或引用文件未能读取，请处理读取警告后再删除。");
  if (item.referencedBy.length)
    throw new MediaError(`图片仍有 ${item.referencedBy.length} 处引用，请先移除引用。`);
  const target = await assertProjectMediaLocation(report, absolute);
  if (!(await lstat(target.filename)).isFile()) throw new MediaError("图片目标不是普通文件。");
  return moveToRecycleBin(
    target.root,
    target.relative,
    "media",
    {
      domain: "media",
      projectRoot: report.root,
    },
    { stateDir },
  );
}
