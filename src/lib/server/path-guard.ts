import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

export class PathGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathGuardError";
  }
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

export function resolveManagedPath(root: string, relativePath: string): string {
  if (!path.isAbsolute(root)) {
    throw new PathGuardError("管理根目录必须是绝对路径");
  }
  if (!relativePath || path.isAbsolute(relativePath) || /^[A-Za-z]:/.test(relativePath)) {
    throw new PathGuardError("目标必须是根目录内的相对路径");
  }
  const segments = relativePath.split(/[\\/]+/);
  if (segments.includes("..") || segments.includes(".")) {
    throw new PathGuardError("目标路径不能包含 . 或 .. 段");
  }
  const candidate = path.resolve(root, relativePath);
  if (!isInside(root, candidate)) {
    throw new PathGuardError("目标路径超出管理根目录");
  }
  return candidate;
}

/** Resolve the nearest existing ancestor to catch symlink/junction escapes before future writes. */
export async function assertManagedRealPath(root: string, relativePath: string): Promise<string> {
  const realRoot = await realpath(root);
  const target = resolveManagedPath(realRoot, relativePath);
  let ancestor = target;
  while (true) {
    try {
      await lstat(ancestor);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw new PathGuardError("目标路径无法解析");
      ancestor = parent;
    }
  }
  const realAncestor = await realpath(ancestor);
  if (!isInside(realRoot, realAncestor)) {
    throw new PathGuardError("目标路径经过链接指向管理根目录之外");
  }
  return target;
}
