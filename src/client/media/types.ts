import type { MediaItem, ProjectReport } from "../types";

export type MediaScope = "public" | "article";

export interface MediaData {
  report: ProjectReport;
  media: MediaItem[];
  articles: Array<{ id: string; title: string }>;
}
