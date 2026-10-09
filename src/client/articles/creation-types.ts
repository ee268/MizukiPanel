import type { ArticleTemplateSettings } from "../../shared/panel-settings";
export interface CreationDefaults {
  projectKey: string;
  settingsVersion: string | null;
  values: ArticleTemplateSettings;
  warnings: string[];
  readOnly: boolean;
}
export interface CreationFields {
  id: string;
  title: string;
  published: string;
  draft: boolean;
  body: string;
  frontmatter: string;
}
export interface CreationPreview {
  id: string;
  source: string;
  previewPath: string;
  projectKey: string;
  settingsVersion: string | null;
  previewVersion: string;
}
export { localCalendarDate as localDate } from "../../shared/panel-settings/article-template";
