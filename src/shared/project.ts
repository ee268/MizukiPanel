export type ContentMode = "local" | "external" | "blocked";

export interface SourceMapping {
  key: "posts" | "spec" | "data" | "images" | "animes" | "config";
  label: string;
  sourcePath: string;
  resolvedPath?: string;
  exists: boolean;
  note?: string;
}

export interface ProjectReport {
  requestedPath: string;
  root: string;
  mode: ContentMode;
  readOnly: boolean;
  contentRoot: string | null;
  warnings: string[];
  mappings: SourceMapping[];
  detectedReadOnly?: boolean;
  preferenceReadOnly?: boolean;
  settingsReadOnly?: boolean;
}
