import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveManagedPath } from "./path-guard";

export interface ArchiveContext {
  domain: "article" | "config" | "feature" | "media" | "settings" | "workspace";
  projectRoot?: string;
}
export interface ArchiveMetadata extends ArchiveContext {
  schemaVersion: 1;
  kind: "backup" | "trash";
  createdAt: string;
  projectKey: string | null;
  root: string;
  relative: string;
  digest: string;
  bytes: number;
  directory: boolean;
  /** Article and its AI sessions are stored as one integrity-checked recycle bundle. */
  articleBundle?: true;
}
export const archiveHash = (input: string) => createHash("sha256").update(input).digest("hex");
export const canonicalPath = (input: string) =>
  process.platform === "win32" ? path.resolve(input).toLowerCase() : path.resolve(input);

// Bound scans and stream file contents; never follow symbolic links in recovery data.
export async function archiveSnapshot(filename: string) {
  let bytes = 0;
  let entries = 0;
  const hash = createHash("sha256");
  async function visit(current: string, relative: string, depth: number): Promise<void> {
    if (++entries > 10000 || depth > 32) throw new Error("恢复数据超过扫描上限。");
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()))
      throw new Error("恢复数据含链接或特殊文件，不能操作。");
    hash.update(
      JSON.stringify([
        relative,
        stat.isDirectory() ? "directory" : "file",
        stat.isDirectory() ? 0 : stat.size,
      ]),
    );
    if (stat.isDirectory()) {
      // Directory size is platform dependent, so hash a fixed marker instead.
      for (const name of (await readdir(current)).sort())
        await visit(path.join(current, name), relative ? `${relative}/${name}` : name, depth + 1);
    } else {
      bytes += stat.size;
      if (bytes > 1024 * 1024 * 1024) throw new Error("恢复数据超过 1 GiB，需手动处理。");
      for await (const chunk of createReadStream(current)) hash.update(chunk);
    }
  }
  const directory = (await lstat(filename)).isDirectory();
  await visit(filename, "", 0);
  return { digest: hash.digest("hex"), bytes, directory };
}

export async function createArchiveMetadata(
  payload: string,
  kind: ArchiveMetadata["kind"],
  root: string,
  relative: string,
  context: ArchiveContext,
): Promise<ArchiveMetadata> {
  const canonicalRoot = await realpath(root);
  resolveManagedPath(canonicalRoot, relative);
  const projectRoot = context.projectRoot ? await realpath(context.projectRoot) : undefined;
  const metadata: ArchiveMetadata = {
    ...context,
    projectRoot,
    schemaVersion: 1,
    kind,
    createdAt: new Date().toISOString(),
    projectKey: projectRoot
      ? archiveHash(canonicalPath(projectRoot))
      : context.domain === "settings"
        ? (/^project-settings\/([a-f0-9]{64})\.json$/.exec(relative)?.[1] ?? null)
        : null,
    root: canonicalRoot,
    relative: relative.replace(/\\/g, "/"),
    ...(await archiveSnapshot(payload)),
  };
  return metadata;
}

export async function recordArchive(
  payload: string,
  kind: ArchiveMetadata["kind"],
  root: string,
  relative: string,
  context: ArchiveContext,
): Promise<ArchiveMetadata> {
  const metadata = await createArchiveMetadata(payload, kind, root, relative, context);
  // Finish indexing before replacing/deleting the original. Failure aborts that operation.
  await writeFile(payload + ".meta.json", JSON.stringify(metadata, null, 2) + "\n", {
    flag: "wx",
  });
  return metadata;
}
