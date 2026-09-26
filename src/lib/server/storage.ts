import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, copyFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { assertManagedRealPath } from './path-guard';

export class StorageConflict extends Error {
  constructor(message: string) { super(message); this.name = 'StorageConflict'; }
}
export const contentVersion = (content: Buffer | string): string =>
  createHash('sha256').update(content).digest('hex');
async function versionOf(filename: string): Promise<string | null> {
  try { return contentVersion(await readFile(filename)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
export async function readManagedFile(root: string, relative: string) {
  const filename = await assertManagedRealPath(root, relative);
  const content = await readFile(filename, 'utf8');
  return { content, version: contentVersion(content) };
}
export async function writeManagedFile(
  root: string, relative: string, content: string,
  expectedVersion: string | null, backupRoot: string
): Promise<{ version: string; backupPath: string | null }> {
  const filename = await assertManagedRealPath(root, relative);
  await mkdir(path.dirname(filename), { recursive: true });
  const lockPath = filename + '.mizuki-panel.lock';
  let lock;
  try { lock = await open(lockPath, 'wx'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new StorageConflict('文件正在被其他操作修改');
    throw error;
  }
  const temporary = filename + '.mizuki-panel-' + randomUUID() + '.tmp';
  try {
    const current = await versionOf(filename);
    if (current !== expectedVersion) throw new StorageConflict('文件自读取后已改变，请重新加载再保存');
    if (current !== null && !(await lstat(filename)).isFile()) throw new StorageConflict('目标不是普通文件');
    let backupPath: string | null = null;
    if (current !== null) {
      await mkdir(backupRoot, { recursive: true });
      backupPath = path.join(backupRoot, randomUUID() + '.bak');
      await copyFile(filename, backupPath);
    }
    const tempHandle = await open(temporary, 'wx');
    try { await tempHandle.writeFile(content, 'utf8'); await tempHandle.sync(); }
    finally { await tempHandle.close(); }
    await rename(temporary, filename);
    return { version: contentVersion(content), backupPath };
  } finally {
    await rm(temporary, { force: true });
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
export async function restoreManagedFile(
  root: string, relative: string, backupPath: string,
  expectedCurrentVersion: string, backupRoot: string
) {
  const safeBackup = path.resolve(backupPath);
  const relativeBackup = path.relative(path.resolve(backupRoot), safeBackup);
  if (!relativeBackup || relativeBackup.startsWith('..') || path.isAbsolute(relativeBackup))
    throw new StorageConflict('备份路径不在面板备份目录中');
  const original = await readFile(safeBackup, 'utf8');
  return writeManagedFile(root, relative, original, expectedCurrentVersion, backupRoot);
}
