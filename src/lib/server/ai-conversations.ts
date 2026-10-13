import { createHash } from "node:crypto";
import path from "node:path";
import { lstat, mkdir, open, rm } from "node:fs/promises";
import {
  emptyConversations,
  ConversationValidationError,
  parseStoredConversations,
  type ConversationSnapshot,
} from "../../shared/ai-conversations";
import { readManagedFile, StorageConflict, writeManagedFile } from "./storage";
import { canonicalPath } from "./archive-metadata";
import { assertManagedRealPath } from "./path-guard";

export function conversationFile(projectRoot: string, article: string): string {
  const project = createHash("sha256").update(canonicalPath(projectRoot)).digest("hex");
  const file = createHash("sha256").update(article.replaceAll("\\", "/")).digest("hex");
  return path.join("ai-conversations", project, `${file}.json`);
}

/** Serialize saves, article deletion and recovery for this article across processes. */
export async function withConversationFile<T>(
  stateDir: string,
  projectRoot: string,
  article: string,
  work: (filename: string) => Promise<T>,
): Promise<T> {
  await mkdir(stateDir, { recursive: true });
  const filename = await assertManagedRealPath(stateDir, conversationFile(projectRoot, article));
  await mkdir(path.dirname(filename), { recursive: true });
  const lockPath = filename + ".lifecycle.lock";
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new StorageConflict("文章会话正在被其他操作修改，请重试。");
    throw error;
  }
  try {
    await existingConversationFile(filename);
    return await work(filename);
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}

export async function existingConversationFile(filename: string): Promise<boolean> {
  try {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new StorageConflict("会话路径不是普通文件，未修改文章或会话。");
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
export async function readConversations(
  stateDir: string,
  projectRoot: string,
  article: string,
): Promise<ConversationSnapshot> {
  try {
    const saved = await readManagedFile(stateDir, conversationFile(projectRoot, article));
    return {
      version: saved.version,
      document: parseStoredConversations(JSON.parse(saved.content)),
    };
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT")
      return { version: null, document: emptyConversations() };
    if (cause instanceof SyntaxError)
      throw new ConversationValidationError(
        "会话文件损坏，原文件已保留，请检查本机会话文件后重试。",
      );
    throw cause;
  }
}
export async function saveConversations(
  stateDir: string,
  projectRoot: string,
  article: string,
  document: unknown,
  version: string | null,
  assertArticleExists?: () => Promise<unknown>,
): Promise<ConversationSnapshot> {
  const safe = parseStoredConversations(document);
  return withConversationFile(stateDir, projectRoot, article, async () => {
    // Check under the same lock as deletion: a late autosave cannot recreate orphan sessions.
    await assertArticleExists?.();
    const saved = await writeManagedFile(
      stateDir,
      conversationFile(projectRoot, article),
      JSON.stringify(safe) + "\n",
      version,
      null,
    );
    return { version: saved.version, document: safe };
  });
}
