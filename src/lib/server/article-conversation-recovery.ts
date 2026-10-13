import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  copyFile,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { archiveSnapshot, createArchiveMetadata } from "./archive-metadata";
import {
  conversationFile,
  existingConversationFile,
  withConversationFile,
} from "./ai-conversations";
import { assertManagedRealPath } from "./path-guard";
import { RECYCLE_DIRECTORY } from "./recycle-bin";
import { contentVersion, StorageConflict } from "./storage";

export const RECYCLED_ARTICLE = "article.md";
export const RECYCLED_CONVERSATIONS = "conversations.json";

/** Caller holds the conversation lifecycle lock. Index both copies before deleting either source. */
export async function recycleArticleWithConversations(
  root: string,
  relative: string,
  projectRoot: string,
  stateDir: string,
  conversations: string,
  version: string,
): Promise<string> {
  const source = await assertManagedRealPath(root, relative);
  const lockPath = source + ".mizuki-panel.lock";
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new StorageConflict("文章正在被其他操作修改。");
    throw error;
  }
  let bundle: string | undefined;
  let removedConversations = false;
  let committed = false;
  let preserveCopy = false;
  try {
    const original = await archiveSnapshot(source);
    if (original.directory || contentVersion(await readFile(source)) !== version)
      throw new StorageConflict("文件自读取后已改变，请重新加载再删除。");
    const sessions = await archiveSnapshot(conversations);
    const destination = `${RECYCLE_DIRECTORY}/articles/${randomUUID()}-${path.basename(source)}`;
    bundle = await assertManagedRealPath(stateDir, destination);
    await mkdir(bundle, { recursive: true });
    await copyFile(source, path.join(bundle, RECYCLED_ARTICLE), constants.COPYFILE_EXCL);
    await copyFile(
      conversations,
      path.join(bundle, RECYCLED_CONVERSATIONS),
      constants.COPYFILE_EXCL,
    );
    if (
      (await archiveSnapshot(path.join(bundle, RECYCLED_ARTICLE))).digest !== original.digest ||
      (await archiveSnapshot(path.join(bundle, RECYCLED_CONVERSATIONS))).digest !== sessions.digest
    )
      throw new StorageConflict("文章或会话在回收期间发生变化。");
    const metadata = await createArchiveMetadata(bundle, "trash", root, relative, {
      domain: "article",
      projectRoot,
    });
    metadata.articleBundle = true;
    await writeFile(bundle + ".meta.json", JSON.stringify(metadata, null, 2) + "\n", {
      flag: "wx",
    });
    if (
      (await archiveSnapshot(source)).digest !== original.digest ||
      (await archiveSnapshot(conversations)).digest !== sessions.digest ||
      contentVersion(await readFile(source)) !== version
    )
      throw new StorageConflict("文章或会话在回收期间发生变化。");
    await rm(conversations);
    removedConversations = true;
    await rm(source);
    committed = true;
    return bundle;
  } catch (error) {
    if (removedConversations && bundle) {
      try {
        await copyFile(
          path.join(bundle, RECYCLED_CONVERSATIONS),
          conversations,
          constants.COPYFILE_EXCL,
        );
      } catch {
        // Retain the indexed recovery copy if an external change prevents rollback.
        preserveCopy = true;
      }
    }
    throw error;
  } finally {
    try {
      if (bundle && !committed && !preserveCopy) {
        await rm(bundle, { recursive: true, force: true });
        await rm(bundle + ".meta.json", { force: true });
      }
    } finally {
      await lock.close();
      await rm(lockPath, { force: true });
    }
  }
}

/** Stage the conversation file so failed article validation/deletion can restore it unchanged. */
export async function permanentlyRemoveArticleConversations(
  filename: string,
  removeArticle: () => Promise<unknown>,
) {
  if (!(await existingConversationFile(filename))) return removeArticle();
  const staged = filename + ".delete-" + randomUUID() + ".tmp";
  await rename(filename, staged);
  try {
    await removeArticle();
  } catch (error) {
    await link(staged, filename);
    await rm(staged);
    throw error;
  }
  await rm(staged);
}

export async function validateArticleBundle(bundle: string) {
  const names = (await readdir(bundle)).sort();
  if (names.length !== 2 || names[0] !== RECYCLED_ARTICLE || names[1] !== RECYCLED_CONVERSATIONS)
    throw new StorageConflict("文章回收项结构无效，已保留。");
  for (const name of names) {
    const stat = await lstat(path.join(bundle, name));
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new StorageConflict("文章回收项包含链接或非普通文件，已保留。");
  }
}

export async function assertConversationRecoveryAvailable(
  stateDir: string,
  projectRoot: string,
  article: string,
) {
  const filename = await assertManagedRealPath(stateDir, conversationFile(projectRoot, article));
  if (await existingConversationFile(filename))
    throw new StorageConflict("该文章已有 AI 会话，恢复不会覆盖现有会话。");
}

export async function restoreArticleConversations(
  stateDir: string,
  projectRoot: string,
  article: string,
  bundle: string,
  expectedDigest: string,
  restoreArticle: (source: string) => Promise<unknown>,
) {
  await validateArticleBundle(bundle);
  if ((await archiveSnapshot(bundle)).digest !== expectedDigest)
    throw new StorageConflict("文章回收内容在恢复期间发生变化。");
  return withConversationFile(stateDir, projectRoot, article, async (filename) => {
    if (await existingConversationFile(filename))
      throw new StorageConflict("该文章已有 AI 会话，恢复不会覆盖现有会话。");
    const source = await readFile(path.join(bundle, RECYCLED_ARTICLE), "utf8");
    const staged = filename + ".restore-" + randomUUID() + ".tmp";
    let linked = false;
    try {
      await copyFile(path.join(bundle, RECYCLED_CONVERSATIONS), staged, constants.COPYFILE_EXCL);
      if (
        (await archiveSnapshot(bundle)).digest !== expectedDigest ||
        (await archiveSnapshot(staged)).digest !==
          (await archiveSnapshot(path.join(bundle, RECYCLED_CONVERSATIONS))).digest
      )
        throw new StorageConflict("文章回收内容在恢复期间发生变化。");
      // Link publishes without replacing anything that appeared after the existence check.
      await link(staged, filename);
      linked = true;
      await restoreArticle(source);
    } catch (error) {
      if (linked) await rm(filename);
      throw error;
    } finally {
      await rm(staged, { force: true });
    }
  });
}
