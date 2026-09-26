import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function stateFile(stateDir: string): string {
  return path.join(stateDir, 'workspace.json');
}

export function defaultStateDir(): string {
  return path.resolve(process.cwd(), '.local');
}

export async function readWorkspacePath(stateDir = defaultStateDir()): Promise<string | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(stateFile(stateDir), 'utf8'));
    if (typeof parsed === 'object' && parsed !== null && 'projectPath' in parsed && typeof parsed.projectPath === 'string') {
      return parsed.projectPath;
    }
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function saveWorkspacePath(projectPath: string, stateDir = defaultStateDir()): Promise<void> {
  await mkdir(stateDir, { recursive: true });
  const tempFile = path.join(stateDir, `.workspace-${randomUUID()}.tmp`);
  try {
    await writeFile(tempFile, JSON.stringify({ projectPath }, null, 2), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await rename(tempFile, stateFile(stateDir));
  } catch (error) {
    await rm(tempFile, { force: true });
    throw error;
  }
}

export async function clearWorkspace(stateDir = defaultStateDir()): Promise<void> {
  await rm(stateFile(stateDir), { force: true });
}
