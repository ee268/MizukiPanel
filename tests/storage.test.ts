import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, expect, it } from "vitest";
import {
  readManagedFile,
  restoreManagedFile,
  StorageConflict,
  writeManagedFile,
} from "../src/lib/server/storage";
import { inspectGit } from "../src/lib/server/git";
const dirs: string[] = [];
async function fixture() {
  const base = await mkdtemp(path.join(tmpdir(), "mizuki-panel-storage-"));
  dirs.push(base);
  const root = path.join(base, "content");
  const backups = path.join(base, "backups");
  await mkdir(root);
  return { base, root, backups };
}
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
it("requires a current version and restores only over the expected version", async () => {
  const { root, backups } = await fixture();
  await writeFile(path.join(root, "post.md"), "original");
  const before = await readManagedFile(root, "post.md");
  await expect(writeManagedFile(root, "post.md", "wrong", "stale", backups)).rejects.toBeInstanceOf(
    StorageConflict,
  );
  expect(await readFile(path.join(root, "post.md"), "utf8")).toBe("original");
  const saved = await writeManagedFile(root, "post.md", "edited", before.version, backups);
  expect(saved.backupPath).not.toBeNull();
  await writeFile(path.join(root, "post.md"), "external edit");
  await expect(
    restoreManagedFile(root, "post.md", saved.backupPath!, saved.version, backups),
  ).rejects.toBeInstanceOf(StorageConflict);
  expect(await readFile(path.join(root, "post.md"), "utf8")).toBe("external edit");
  const current = await readManagedFile(root, "post.md");
  await restoreManagedFile(root, "post.md", saved.backupPath!, current.version, backups);
  expect(await readFile(path.join(root, "post.md"), "utf8")).toBe("original");
});
it("reads Git changes without altering the working tree", async () => {
  const { root } = await fixture();
  execFileSync("git", ["init", root], { stdio: "ignore" });
  await writeFile(path.join(root, "draft.md"), "unsaved");
  const status = await inspectGit(root);
  expect(status.changes).toContainEqual({ status: "??", path: "draft.md" });
  expect(await readFile(path.join(root, "draft.md"), "utf8")).toBe("unsaved");
});
