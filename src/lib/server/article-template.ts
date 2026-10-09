import { slug } from "github-slugger";
import { expandTemplate, templateDefaults } from "../../shared/panel-settings/article-template";
import { record, type ArticleTemplateSettings } from "../../shared/panel-settings";
import { readPanelSettings, settingsProjectKey } from "./panel-settings";
import { contentVersion, StorageConflict } from "./storage";
import {
  ArticleValidationError,
  articleFields,
  newArticleSource,
  parseArticleSource,
} from "./article-format";
import { articlePreviewPath, validateArticleCreation } from "./articles";
import type { ProjectReport } from "./project";

export async function articleProjectKey(report: ProjectReport): Promise<string> {
  return (
    (await settingsProjectKey(report.root)) +
    "." +
    (await settingsProjectKey(report.contentRoot ?? report.root))
  );
}
export async function readArticleTemplate(report: ProjectReport, stateDir?: string) {
  const key = await settingsProjectKey(report.root);
  const settings = await readPanelSettings("project", key, stateDir);
  return {
    projectKey: await articleProjectKey(report),
    settingsVersion: settings.version,
    values: settings.document.values.articleTemplate as unknown as ArticleTemplateSettings,
    warnings: settings.warnings,
    readOnly: settings.readOnly || report.readOnly,
  };
}
export interface CreationInput {
  id: string;
  title: string;
  published: string;
  draft: boolean;
  body: string;
  frontmatter: string;
  projectKey: string;
  settingsVersion: string | null;
}
export async function prepareArticleCreation(
  report: ProjectReport,
  input: unknown,
  stateDir?: string,
) {
  if (
    !record(input) ||
    !["id", "title", "published", "body", "frontmatter", "projectKey"].every(
      (key) => typeof input[key] === "string",
    ) ||
    typeof input.draft !== "boolean" ||
    !(input.settingsVersion === null || typeof input.settingsVersion === "string")
  )
    throw new ArticleValidationError("新建文章参数不完整。");
  const fields = input as unknown as CreationInput;
  const current = await readArticleTemplate(report, stateDir);
  if (
    current.projectKey !== fields.projectKey ||
    current.settingsVersion !== fields.settingsVersion
  )
    throw new StorageConflict("项目或新建文章默认值已变化，请更新预览基准后重试。");
  if (fields.body.length > 100000 || fields.frontmatter.length > 16000)
    throw new ArticleValidationError("新建模板内容过长。");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.published))
    throw new ArticleValidationError("发布日期必须为 YYYY-MM-DD。");
  const [year, month, day] = fields.published.split("-");
  const variables = {
    title: fields.title.trim(),
    date: fields.published,
    year,
    month,
    day,
    slug: slug(fields.title.trim()) || "post",
  };
  let source: string, id: string;
  try {
    source = newArticleSource(
      { title: fields.title, published: fields.published, draft: fields.draft },
      expandTemplate(fields.body, variables),
      templateDefaults(fields.frontmatter, variables),
    );
    const parsed = parseArticleSource(source);
    id = fields.id || expandTemplate(current.values.fileName, variables);
    await validateArticleCreation(report, id, source);
    const previewPath = articlePreviewPath({ id, slug: articleFields(parsed.data).slug });
    return {
      id,
      source,
      previewPath,
      projectKey: current.projectKey,
      settingsVersion: current.settingsVersion,
      previewVersion: contentVersion(
        JSON.stringify([id, source, current.projectKey, current.settingsVersion]),
      ),
    };
  } catch (error) {
    if (error instanceof StorageConflict) throw error;
    throw new ArticleValidationError((error as Error).message);
  }
}
