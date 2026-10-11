import { constants } from "node:fs";
import { cp, lstat, mkdir, rm, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { recordArchive, archiveSnapshot } from "../archive-metadata";
import { defaultStateDir } from "../workspace";
import { readManagedFile, StorageConflict } from "../storage";
import type { ProjectReport } from "../project";
export const backupDir = () => path.join(defaultStateDir(), "backups");
const trashDir = () => path.join(defaultStateDir(), "trash", "features");
export async function optionalFile(root: string, relative: string) {
  try {
    return await readManagedFile(root, relative);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function copyToTrash(
  source: string,
  name: string,
  report: ProjectReport,
  root: string,
  relative: string,
) {
  const target = path.join(trashDir(), `${randomUUID()}-${name}`);
  await mkdir(path.dirname(target), { recursive: true });
  const stat = await lstat(source);
  const before = await archiveSnapshot(source);
  if (stat.isDirectory())
    await cp(source, target, {
      recursive: true,
      errorOnExist: true,
      force: false,
      mode: constants.COPYFILE_EXCL,
    });
  else
    await cp(source, target, { errorOnExist: true, force: false, mode: constants.COPYFILE_EXCL });
  try {
    const metadata = await recordArchive(target, "trash", root, relative, {
      domain: "feature",
      projectRoot: report.root,
    });
    if (
      metadata.digest !== before.digest ||
      (await archiveSnapshot(source)).digest !== before.digest
    )
      throw new StorageConflict("回收期间内容发生变化，请重试。");
    stat.isDirectory() ? await rm(source, { recursive: true }) : await unlink(source);
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    await rm(target + ".meta.json", { force: true });
    throw error;
  }
  return target;
}
