import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { cp, lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { archiveSnapshot, createArchiveMetadata, type ArchiveContext } from "./archive-metadata";
import { assertManagedRealPath } from "./path-guard";
import { contentVersion, StorageConflict } from "./storage";
import { defaultStateDir } from "./workspace";

export const RECYCLE_DIRECTORY = "recycle-bin";
export const RECYCLE_CATEGORIES = ["articles", "features", "media"] as const;
type RecycleCategory = (typeof RECYCLE_CATEGORIES)[number];

/** Move only explicitly recycled resources, keeping their original location in a sidecar. */
export async function moveToRecycleBin(
  root: string,
  relative: string,
  category: RecycleCategory,
  context: ArchiveContext,
  options: { stateDir?: string; version?: string; versionFile?: string } = {},
): Promise<string> {
  const source = await assertManagedRealPath(root, relative);
  if ((await lstat(source)).isSymbolicLink()) throw new StorageConflict("不能回收链接文件。");
  const lockPath = source + ".mizuki-panel.lock";
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new StorageConflict("文件正在被其他操作修改。");
    throw error;
  }
  let target: string | undefined;
  let indexed = false;
  let copied = false;
  let preserveCopy = false;
  try {
    const checkVersion = async () => {
      if (options.version === undefined) return;
      const filename = options.versionFile
        ? await assertManagedRealPath(root, options.versionFile)
        : source;
      if (contentVersion(await readFile(filename)) !== options.version)
        throw new StorageConflict("文件自读取后已改变，请重新加载再删除。");
    };
    await checkVersion();
    const metadata = await createArchiveMetadata(source, "trash", root, relative, context);
    const stateDir = options.stateDir ?? defaultStateDir();
    await mkdir(stateDir, { recursive: true });
    const destination = `${RECYCLE_DIRECTORY}/${category}/${randomUUID()}-${path.basename(source)}`;
    target = await assertManagedRealPath(stateDir, destination);
    await mkdir(path.dirname(target), { recursive: true });
    target = await assertManagedRealPath(stateDir, destination);
    await writeFile(target + ".meta.json", JSON.stringify(metadata, null, 2) + "\n", {
      flag: "wx",
    });
    indexed = true;
    await checkVersion();
    if ((await archiveSnapshot(source)).digest !== metadata.digest)
      throw new StorageConflict("内容在回收期间发生变化，请重试。");
    try {
      await rename(source, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
      // Cross-volume rename is unavailable: copy, verify, then remove the source.
      copied = true;
      await cp(source, target, {
        recursive: metadata.directory,
        errorOnExist: true,
        force: false,
        mode: constants.COPYFILE_EXCL,
      });
      await checkVersion();
      if (
        (await archiveSnapshot(target)).digest !== metadata.digest ||
        (await archiveSnapshot(source)).digest !== metadata.digest
      )
        throw new StorageConflict("内容在跨磁盘回收期间发生变化，请重试。");
      try {
        await rm(source, { recursive: metadata.directory });
      } catch (error) {
        // A failed recursive removal may already have removed some children.
        // Keep the verified copy so those bytes cannot be lost during rollback.
        preserveCopy = metadata.directory;
        throw error;
      }
    }
    return target;
  } catch (error) {
    if (target && copied && !preserveCopy) await rm(target, { recursive: true, force: true });
    if (target && indexed && !preserveCopy) await rm(target + ".meta.json", { force: true });
    throw error;
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
