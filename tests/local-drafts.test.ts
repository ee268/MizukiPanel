import { afterEach, expect, it, vi } from "vitest";
import {
  draftKey,
  draftTarget,
  DraftConflict,
  DraftWriter,
  isLocalDraft,
  type DraftStore,
  type LocalDraft,
} from "../src/client/articles/local-drafts";
function row(project = "project-a", session = "session-a"): LocalDraft {
  return {
    schemaVersion: 1,
    key: draftKey(project, "same.md", session),
    target: draftTarget(project, "same.md"),
    projectKey: project,
    articleId: "same.md",
    sessionId: session,
    revision: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    format: "md",
    baseVersion: "disk-1",
    baseSource: "\ufeff---\r\ntitle: Keep\r\ncustom: [one]\r\n---\r\nBody\r\n",
    source: "\ufeff---\r\ntitle: Keep\r\ncustom: [one]\r\n---\r\nEdited\r\n",
    baseFrontmatter: [{ key: "custom", value: "[one]" }],
    frontmatter: [{ rowId: "id-1", key: "custom", value: "[one, two]", originalKey: "custom" }],
  };
}
function memory() {
  const entries = new Map<string, LocalDraft>();
  const store: DraftStore = {
    list: async (project, article) => ({
      entries: [...entries.values()].filter(
        (value) => value.projectKey === project && (!article || value.articleId === article),
      ),
      unreadable: 0,
    }),
    put: async (value, expected) => {
      if ((entries.get(value.key)?.revision ?? null) !== expected) throw new DraftConflict();
      entries.set(value.key, structuredClone(value));
    },
    remove: async (key, expected) => {
      if ((entries.get(key)?.revision ?? null) !== expected) throw new DraftConflict();
      entries.delete(key);
    },
  };
  return { entries, store };
}
afterEach(() => vi.useRealTimers());
it("checkpoints the latest source and independent Frontmatter and propagates storage failure", async () => {
  const db = memory();
  const writer = new DraftWriter(db.store, () => {});
  const first = row();
  writer.schedule(first, 10000);
  const latest = { ...first, revision: crypto.randomUUID(), source: first.source + "最新正文" };
  await writer.checkpoint(latest);
  expect(db.entries.get(latest.key)).toEqual(latest);
  const put = db.store.put;
  db.store.put = async () => {
    throw new Error("quota");
  };
  await expect(writer.checkpoint({ ...latest, revision: crypto.randomUUID() })).rejects.toThrow(
    "quota",
  );
  expect(db.entries.get(latest.key)).toEqual(latest);
  db.store.put = put;
  await writer.checkpoint({ ...latest, revision: crypto.randomUUID(), source: "retry" });
  expect(db.entries.get(latest.key)?.source).toBe("retry");
});
it("keeps an explicit flush when locking the editor cancels automatic work", async () => {
  const db = memory();
  const writer = new DraftWriter(db.store, () => {});
  const value = row();
  writer.schedule(value, 2000);
  const flushing = writer.flush(true);
  writer.cancel();
  await flushing;
  expect(db.entries.get(value.key)?.source).toBe(value.source);
  writer.cancel();
});
it("isolates project/article/session branches and keeps complete text and independent Frontmatter", async () => {
  const db = memory();
  for (const value of [row(), row("project-a", "session-b"), row("project-b")])
    await db.store.put(value, null);
  expect((await db.store.list("project-a", "same.md")).entries).toHaveLength(2);
  expect((await db.store.list("project-b")).entries).toHaveLength(1);
  const saved = (await db.store.list("project-a")).entries[0];
  expect(saved.source.startsWith("\ufeff")).toBe(true);
  expect(saved.source).toContain("\r\n");
  expect(saved.frontmatter[0].value).toBe("[one, two]");
  expect(saved.baseSource).toContain("custom: [one]");
  expect(isLocalDraft(saved)).toBe(true);
  expect(isLocalDraft({ ...saved, schemaVersion: 99 })).toBe(false);
  expect(isLocalDraft({ ...saved, frontmatter: [{ key: "x", value: 0 }] })).toBe(false);
});
it("debounces edits, flushes the latest snapshot and cancels work when disabled", async () => {
  vi.useFakeTimers();
  const db = memory();
  const writer = new DraftWriter(db.store, () => {});
  const first = row();
  writer.schedule(first, 2000);
  writer.schedule({ ...first, revision: "new", source: "latest" }, 2000);
  await vi.advanceTimersByTimeAsync(1999);
  expect(db.entries.size).toBe(0);
  await writer.flush();
  expect(db.entries.get(first.key)?.source).toBe("latest");
  writer.schedule({ ...first, revision: "cancelled", source: "cancelled" }, 2000);
  writer.cancel();
  await vi.advanceTimersByTimeAsync(5000);
  expect(db.entries.get(first.key)?.source).toBe("latest");
});
it("serializes retirement after an in-flight write so old drafts cannot return after a save", async () => {
  vi.useFakeTimers();
  const db = memory();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = db.store.put;
  db.store.put = async (value, expected) => {
    await gate;
    await original(value, expected);
  };
  const writer = new DraftWriter(db.store, () => {});
  const value = row();
  writer.schedule(value, 1000);
  const flushing = writer.flush();
  await Promise.resolve();
  const retired = writer.retire(value.key);
  release();
  await flushing;
  await retired;
  await vi.advanceTimersByTimeAsync(5000);
  expect(db.entries.size).toBe(0);
});
it("keeps input snapshots and other sessions on storage failures or stale record revisions", async () => {
  const db = memory();
  const foreign = row("project-a", "session-b");
  await db.store.put(foreign, null);
  const errors: unknown[] = [];
  const writer = new DraftWriter(db.store, (_, error) => {
    if (error) errors.push(error);
  });
  const value = row();
  writer.schedule(value, 0);
  await writer.flush();
  await db.store.put({ ...value, revision: "external" }, value.revision);
  writer.schedule({ ...value, revision: "stale" }, 0);
  await writer.flush();
  expect(db.entries.get(value.key)?.revision).toBe("external");
  expect(errors).toHaveLength(1);
  await expect(db.store.remove(value.key, value.revision)).rejects.toBeInstanceOf(DraftConflict);
  expect(db.entries.get(foreign.key)).toEqual(foreign);
  db.store.put = async () => {
    throw new Error("quota");
  };
  writer.schedule({ ...value, revision: "failed", source: "still in memory" }, 0);
  await writer.flush();
  expect(errors).toHaveLength(2);
  expect(value.source).toContain("Edited");
  writer.cancel();
});
