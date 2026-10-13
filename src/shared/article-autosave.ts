import type { FrontmatterEntry } from "./article";
import type { SourceIslandEdit } from "../lib/server/article-body-validation";

export type ArticleSaveScope = "body" | "frontmatter" | "both";
export interface ArticleAutosaveSettings {
  enabled: boolean;
  scope: ArticleSaveScope;
  trigger: "exit" | "interval" | "both";
  intervalSeconds: number;
}
export interface ArticleAutosaveRequest {
  id: string;
  projectKey: string;
  version: string;
  body?: string;
  entries?: FrontmatterEntry[];
  sourceEdits?: SourceIslandEdit[];
}
export const autosaveOnExit = (settings: ArticleAutosaveSettings) =>
  settings.enabled && settings.trigger !== "interval";
export const autosaveOnInterval = (settings: ArticleAutosaveSettings) =>
  settings.enabled && settings.trigger !== "exit";
