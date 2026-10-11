import type { ProjectReport } from "../types";
import type { ProjectImage, ImageFolder } from "../../shared/project-media";
import type { MediaSettings } from "../../shared/media-settings";

export type MediaScope = "public" | "article";

export interface MediaData {
  report: ProjectReport;
  media: ProjectImage[];
  folders: ImageFolder[];
  defaultFolder: string;
  warnings: string[];
  preferences: {
    projectKey: string;
    settingsVersion: string | null;
    values: MediaSettings;
    warnings: string[];
    readOnly: boolean;
  };
}
