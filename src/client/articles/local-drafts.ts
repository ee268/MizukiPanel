import type { FrontmatterEntry } from "../types";
import type { FrontmatterRow } from "./types";
export interface LocalDraft {
  schemaVersion: 1;
  key: string;
  target: string;
  projectKey: string;
  articleId: string;
  sessionId: string;
  revision: string;
  updatedAt: string;
  format: "md" | "mdx";
  baseVersion: string;
  baseSource: string;
  baseFrontmatter: FrontmatterEntry[];
  source: string;
  frontmatter: FrontmatterRow[];
  missing?: boolean;
}
export const draftTarget = (project: string, article: string) => JSON.stringify([project, article]);
export const draftKey = (project: string, article: string, session: string) =>
  JSON.stringify([project, article, session]);
export function isLocalDraft(value: unknown): value is LocalDraft {
  if (!value || typeof value !== "object") return false;
  const row = value as LocalDraft;
  const fields = [
    row.projectKey,
    row.articleId,
    row.sessionId,
    row.revision,
    row.updatedAt,
    row.baseVersion,
    row.baseSource,
    row.source,
  ];
  const validRows = (rows: unknown): boolean =>
    Array.isArray(rows) &&
    rows.every(
      (entry) =>
        entry &&
        typeof entry.key === "string" &&
        typeof entry.value === "string" &&
        (entry.originalKey === undefined || typeof entry.originalKey === "string"),
    );
  return (
    row.schemaVersion === 1 &&
    fields.every((field) => typeof field === "string") &&
    (row.format === "md" || row.format === "mdx") &&
    (row.missing === undefined || typeof row.missing === "boolean") &&
    row.key === draftKey(row.projectKey, row.articleId, row.sessionId) &&
    row.target === draftTarget(row.projectKey, row.articleId) &&
    validRows(row.baseFrontmatter) &&
    validRows(row.frontmatter) &&
    row.frontmatter.every((entry) => typeof entry.rowId === "string")
  );
}
export class DraftConflict extends Error {}
export interface DraftStore {
  list(
    projectKey: string,
    articleId?: string,
  ): Promise<{ entries: LocalDraft[]; unreadable: number }>;
  put(row: LocalDraft, expected: string | null): Promise<void>;
  remove(key: string, expected: string | null): Promise<void>;
}
export class IndexedDraftStore implements DraftStore {
  private database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let rejected = false;
      const request = indexedDB.open("mizuki-panel-drafts", 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("drafts", { keyPath: "key" });
        store.createIndex("project", "projectKey");
        store.createIndex("target", "target");
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        rejected = true;
        reject(new Error("草稿数据库升级被其他标签页阻塞，请关闭旧页面后重试。"));
      };
      request.onsuccess = () => {
        if (rejected) request.result.close();
        else resolve(request.result);
      };
    });
  }
  private async transaction<T>(
    mode: IDBTransactionMode,
    action: (
      store: IDBObjectStore,
      set: (value: T) => void,
      fail: (cause: unknown) => void,
    ) => void,
  ): Promise<T> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("drafts", mode);
      let value: T;
      let failure: unknown;
      const fail = (cause: unknown) => {
        failure = cause;
        transaction.abort();
      };
      transaction.oncomplete = () => {
        db.close();
        resolve(value);
      };
      transaction.onabort = transaction.onerror = () => {
        db.close();
        reject(failure ?? transaction.error ?? new DraftConflict("草稿已更新，请重新读取后操作。"));
      };
      try {
        action(
          transaction.objectStore("drafts"),
          (next) => {
            value = next;
          },
          fail,
        );
      } catch (error) {
        transaction.abort();
        db.close();
        reject(error);
      }
    });
  }
  list(projectKey: string, articleId?: string) {
    return this.transaction<{ entries: LocalDraft[]; unreadable: number }>(
      "readonly",
      (store, set) => {
        const request =
          articleId === undefined
            ? store.index("project").getAll(projectKey)
            : store.index("target").getAll(draftTarget(projectKey, articleId));
        request.onsuccess = () => {
          const entries = request.result.filter(isLocalDraft) as LocalDraft[];
          set({
            entries: entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
            unreadable: request.result.length - entries.length,
          });
        };
      },
    );
  }
  put(row: LocalDraft, expected: string | null) {
    return this.transaction<void>("readwrite", (store, set, fail) => {
      const request = store.get(row.key);
      request.onsuccess = () => {
        if ((request.result?.revision ?? null) !== expected) {
          store.transaction.abort();
          return;
        }
        try {
          store.put(row);
          set(undefined);
        } catch (cause) {
          fail(cause);
        }
      };
    });
  }
  remove(key: string, expected: string | null) {
    return this.transaction<void>("readwrite", (store, set, fail) => {
      const request = store.get(key);
      request.onsuccess = () => {
        if ((request.result?.revision ?? null) !== expected) {
          store.transaction.abort();
          return;
        }
        try {
          store.delete(key);
          set(undefined);
        } catch (cause) {
          fail(cause);
        }
      };
    });
  }
  relocate(projectKey: string, articleId: string, nextId?: string) {
    return this.transaction<void>("readwrite", (store, set, fail) => {
      const request = store.index("target").getAll(draftTarget(projectKey, articleId));
      request.onsuccess = () => {
        try {
          for (const row of request.result.filter(isLocalDraft) as LocalDraft[]) {
            if (nextId) {
              const next = {
                ...row,
                articleId: nextId,
                target: draftTarget(projectKey, nextId),
                key: draftKey(projectKey, nextId, row.sessionId),
                revision: crypto.randomUUID(),
              };
              const existing = store.get(next.key);
              existing.onsuccess = () => {
                try {
                  if (existing.result) {
                    store.transaction.abort();
                    return;
                  }
                  store.delete(row.key);
                  store.put(next);
                } catch (cause) {
                  fail(cause);
                }
              };
            } else store.put({ ...row, missing: true, revision: crypto.randomUUID() });
          }
          set(undefined);
        } catch (cause) {
          fail(cause);
        }
      };
    });
  }
}
export class DraftWriter {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private pending: LocalDraft | null = null;
  private tail: Promise<void> = Promise.resolve();
  private revisions = new Map<string, string>();
  constructor(
    private store: DraftStore,
    private result: (row: LocalDraft | null, error?: unknown) => void,
  ) {}
  schedule(row: LocalDraft, delay: number) {
    this.cancel();
    this.pending = structuredClone(row);
    this.timer = setTimeout(() => {
      void this.flush();
    }, delay);
  }
  cancel() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.generation++;
    this.pending = null;
  }
  flush(force = false): Promise<void> {
    clearTimeout(this.timer);
    const row = this.pending;
    this.pending = null;
    const generation = this.generation;
    if (!row) return this.tail;
    this.tail = this.tail.then(async () => {
      if (!force && generation !== this.generation) return;
      try {
        await this.store.put(row, this.revisions.get(row.key) ?? null);
        this.revisions.set(row.key, row.revision);
        this.result(row);
      } catch (error) {
        this.result(null, error);
      }
    });
    return this.tail;
  }
  retire(key: string): Promise<void> {
    this.cancel();
    this.tail = this.tail.then(async () => {
      try {
        await this.store.remove(key, this.revisions.get(key) ?? null);
        this.revisions.delete(key);
      } catch (error) {
        this.result(null, error);
      }
    });
    return this.tail;
  }
  forget(key: string) {
    this.cancel();
    this.tail = this.tail.then(() => {
      this.revisions.delete(key);
    });
  }
}
export function draftError(error: unknown): string {
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return "本地草稿存储空间不足，恢复副本未保存。输入仍保留，请手动保存文章。";
  return `本地草稿未能保存或读取：${error instanceof Error ? error.message : "浏览器存储不可用"}。输入仍保留，请手动保存文章。`;
}
export interface DraftEvent {
  projectKey: string;
  articleId: string;
  nextId?: string;
  key?: string;
  type: "write" | "rename" | "delete" | "discard";
}
export function notifyDraft(event: DraftEvent) {
  window.dispatchEvent(new CustomEvent("mizuki-drafts", { detail: event }));
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel("mizuki-panel-drafts");
      channel.postMessage(event);
      channel.close();
    } catch {
      /* Focusing another page still refreshes local records. */
    }
  }
}
