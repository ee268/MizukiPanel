import { parseDocument } from "yaml";
import type { FrontmatterEntry } from "./article";
import { containsApiCredential } from "./api-credentials";

export interface AiFrontmatterChange {
  key: string;
  value: string | null;
}
export function isProtectedFrontmatterKey(key: string): boolean {
  return (
    /password|secret|token|api[-_]?key/i.test(key) ||
    ["__proto__", "prototype", "constructor"].includes(key)
  );
}
export function publicFrontmatter(entries: FrontmatterEntry[]): FrontmatterEntry[] {
  return entries
    .filter((e) => !isProtectedFrontmatterKey(e.key))
    .map(({ key, value }) => ({ key, value }));
}
export function parseAiFrontmatterEntries(input: unknown): FrontmatterEntry[] {
  if (!Array.isArray(input) || input.length > 200 || JSON.stringify(input).length > 60000)
    throw new Error("Frontmatter 草稿上下文无效。");
  return input.map((e) => {
    if (
      !e ||
      typeof e !== "object" ||
      Object.keys(e).some((k) => !["key", "value"].includes(k)) ||
      typeof e.key !== "string" ||
      !e.key.trim() ||
      e.key.length > 128 ||
      typeof e.value !== "string" ||
      e.value.length > 20000 ||
      isProtectedFrontmatterKey(e.key)
    )
      throw new Error("Frontmatter 草稿字段无效或包含敏感字段。");
    return { key: e.key, value: e.value };
  });
}
export function parseAiFrontmatterChanges(input: unknown): AiFrontmatterChange[] {
  if (!Array.isArray(input) || input.length > 100)
    throw new Error("Frontmatter 修改必须是最多 100 个字段的补丁列表。");
  const seen = new Set<string>();
  return input.map((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      Object.keys(entry).some((k) => !["key", "value"].includes(k)) ||
      typeof entry.key !== "string" ||
      !entry.key.trim() ||
      entry.key !== entry.key.trim() ||
      entry.key.length > 128 ||
      /[:\x00-\x1f]/.test(entry.key) ||
      seen.has(entry.key) ||
      isProtectedFrontmatterKey(entry.key)
    )
      throw new Error("Frontmatter 字段名无效、重复或属于敏感字段。");
    seen.add(entry.key);
    if (entry.value !== null) {
      if (
        typeof entry.value !== "string" ||
        entry.value.length > 20000 ||
        containsApiCredential(entry.value)
      )
        throw new Error("Frontmatter 字段值无效或含有敏感数据。");
      const doc = parseDocument(entry.value || "''", { uniqueKeys: true, strict: true });
      if (doc.errors.length) throw new Error(`字段 ${entry.key} 的 YAML 无效。`);
      const value = doc.toJS({ maxAliasCount: 100 });
      if (["pubDate", "updatedDate"].includes(entry.key)) {
        if (
          typeof value !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
          new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
        )
          throw new Error(`字段 ${entry.key} 必须是有效的 YYYY-MM-DD 日期。`);
      }
    }
    return { key: entry.key, value: entry.value };
  });
}
export function mergeAiFrontmatterChanges(
  entries: FrontmatterEntry[],
  changes: AiFrontmatterChange[],
): FrontmatterEntry[] {
  const patches = new Map(parseAiFrontmatterChanges(changes).map((c) => [c.key, c.value]));
  const merged: FrontmatterEntry[] = [];
  for (const entry of entries) {
    if (!patches.has(entry.key)) {
      merged.push({ ...entry });
      continue;
    }
    const value = patches.get(entry.key)!;
    patches.delete(entry.key);
    if (value !== null) merged.push({ ...entry, value });
  }
  for (const [key, value] of patches) if (value !== null) merged.push({ key, value });
  return merged;
}
export function frontmatterFingerprint(entries: FrontmatterEntry[]): string {
  return JSON.stringify(publicFrontmatter(entries));
}
export function changedFrontmatterPatches(
  entries: FrontmatterEntry[],
  changes: AiFrontmatterChange[],
): AiFrontmatterChange[] {
  return changes.filter((change) =>
    change.value === null
      ? entries.some((e) => e.key === change.key)
      : entries.find((e) => e.key === change.key)?.value !== change.value,
  );
}
