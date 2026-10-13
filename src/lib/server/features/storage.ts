import path from "node:path";
import { defaultStateDir } from "../workspace";
import { readManagedFile } from "../storage";
export const backupDir = () => path.join(defaultStateDir(), "backups");
export async function optionalFile(root: string, relative: string) {
  try {
    return await readManagedFile(root, relative);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
