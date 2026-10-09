import type { MediaItem, ProjectReport } from "../types";
import type { MediaSettings } from "../../shared/media-settings";

export type MediaScope = "public" | "article";

export interface MediaData {
  report: ProjectReport;
  media: MediaItem[];
  articles: Array<{ id: string; title: string }>;
  preferences: {
    projectKey: string;
    settingsVersion: string | null;
    values: MediaSettings;
    warnings: string[];
    readOnly: boolean;
  };
}
