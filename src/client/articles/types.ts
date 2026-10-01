import type { FrontmatterEntry } from "../types";

export type ArticleFilter = "all" | "published" | "draft" | "invalid";
export type ArticleEditorMode = "visual" | "frontmatter" | "source";

export interface FrontmatterRow extends FrontmatterEntry {
  rowId: string;
}

export function createFrontmatterRow(entry: FrontmatterEntry): FrontmatterRow {
  return {
    ...entry,
    rowId: crypto.randomUUID(),
  };
}
