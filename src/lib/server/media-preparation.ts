import { randomUUID } from "node:crypto";
import { lstat } from "node:fs/promises";
import path from "node:path";
import type { MediaPreparation, MediaSettings } from "../../shared/media-settings";
import { mediaAlt, validMediaFolder } from "../../shared/media-settings";
import { localCalendarDate } from "../../shared/panel-settings/article-template";
import { readPanelSettings, settingsProjectKey } from "./panel-settings";
import { articleProjectKey } from "./article-template";
import { contentVersion, StorageConflict } from "./storage";
import { assertManagedRealPath } from "./path-guard";
import {
  MediaError,
  mediaTarget,
  uploadMedia,
  validateMediaBytes,
  validateMediaPath,
  type MediaScope,
} from "./media";
import { processImage } from "./image-processing";
import type { ProjectReport } from "./project";

type Prepared = {
  overview: MediaPreparation;
  binding: string;
  settings: string;
  scope: MediaScope;
  articleId?: string;
  original: Buffer;
  processed: Buffer | null;
  busy: boolean;
  expires: number;
};
const preparations = new Map<string, Prepared>();
export const PREPARATION_TTL = 10 * 60 * 1000;
const MAX_PREPARATION_BYTES = 80 * 1024 * 1024;
export async function mediaPreferences(report: ProjectReport, stateDir?: string) {
  const key = await settingsProjectKey(report.root);
  const snapshot = await readPanelSettings("project", key, stateDir);
  return {
    projectKey: await articleProjectKey(report),
    values: snapshot.document.values.media as unknown as MediaSettings,
    settingsVersion: snapshot.version,
    warnings: snapshot.warnings,
    readOnly: snapshot.readOnly || report.readOnly,
  };
}
function prune() {
  for (const [token, item] of preparations)
    if (!item.busy && item.expires <= Date.now()) preparations.delete(token);
}
setInterval(prune, 60_000).unref();
function remember(item: Prepared) {
  prune();
  const bytes = () =>
    [...preparations.values()].reduce(
      (sum, row) => sum + row.original.length + (row.processed?.length ?? 0),
      0,
    );
  while (
    preparations.size >= 8 ||
    bytes() + item.original.length + (item.processed?.length ?? 0) > MAX_PREPARATION_BYTES
  ) {
    const victim = [...preparations.entries()].find(([, row]) => !row.busy);
    if (!victim) throw new MediaError("图片预览资源繁忙，请稍后重试。");
    preparations.delete(victim[0]);
  }
  preparations.set(item.overview.token, item);
}
async function available(
  report: ProjectReport,
  scope: MediaScope,
  mediaPath: string,
  articleId?: string,
) {
  const target = mediaTarget(report, scope, mediaPath, articleId);
  if (
    target.article &&
    !(await lstat(await assertManagedRealPath(target.root, target.article))).isFile()
  )
    throw new MediaError("所属文章不是普通文件。");
  const filename = await assertManagedRealPath(target.root, target.relative);
  try {
    await lstat(filename);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}
export async function prepareMedia(
  report: ProjectReport,
  input: {
    name: string;
    bytes: Buffer;
    scope: MediaScope;
    folder: string;
    articleId?: string;
    projectKey: string;
    settingsVersion: string | null;
  },
  stateDir?: string,
): Promise<MediaPreparation> {
  const preferences = await mediaPreferences(report, stateDir);
  if (preferences.readOnly) throw new MediaError("当前项目或项目设置只读，不能上传图片。");
  if (
    input.projectKey !== preferences.projectKey ||
    input.settingsVersion !== preferences.settingsVersion
  )
    throw new StorageConflict("项目或媒体设置已变化，请重新读取偏好并预览；输入已保留。");
  if (
    input.name.includes("/") ||
    input.name.includes("\\") ||
    input.name.length > 180 ||
    !validMediaFolder(input.folder)
  )
    throw new MediaError("图片文件名或子目录无效。");
  validateMediaPath(input.name);
  validateMediaBytes(input.name, input.bytes);
  const policy = preferences.values;
  const name =
    policy.naming === "unique"
      ? randomUUID() + path.extname(input.name).toLowerCase()
      : policy.naming === "date"
        ? `${localCalendarDate()}-${input.name}`
        : input.name;
  const originalPath = input.folder ? `${input.folder}/${name}` : name;
  const originalAvailable = await available(report, input.scope, originalPath, input.articleId);
  const processed = await processImage(input.bytes, policy);
  const processedPath =
    processed.bytes && processed.extension
      ? originalPath.slice(0, -path.extname(originalPath).length) + processed.extension
      : null;
  const expires = Date.now() + PREPARATION_TTL;
  const overview: MediaPreparation = {
    token: randomUUID(),
    expiresAt: new Date(expires).toISOString(),
    originalName: input.name,
    originalSize: input.bytes.length,
    originalPath,
    originalReference: mediaTarget(report, input.scope, originalPath, input.articleId).reference,
    processedSize: processed.bytes?.length ?? null,
    processedPath,
    processedReference: processedPath
      ? mediaTarget(report, input.scope, processedPath, input.articleId).reference
      : null,
    width: processed.width,
    height: processed.height,
    outputWidth: processed.outputWidth,
    outputHeight: processed.outputHeight,
    status: processed.status,
    message: processed.message,
    alt: mediaAlt(input.name, policy.alt),
    referenceFormat: policy.referenceFormat,
    originalAvailable,
    processedAvailable: processedPath
      ? await available(report, input.scope, processedPath, input.articleId)
      : false,
  };
  remember({
    overview,
    binding: preferences.projectKey,
    settings: contentVersion(JSON.stringify(policy)),
    scope: input.scope,
    articleId: input.articleId,
    original: input.bytes,
    processed: processed.bytes,
    expires,
    busy: false,
  });
  return overview;
}
function prepared(token: string): Prepared {
  prune();
  const result = preparations.get(token);
  if (!result) throw new StorageConflict("上传预览已过期或释放，请重新预览。");
  return result;
}
export async function preparedImage(
  report: ProjectReport,
  token: string,
  variant: "original" | "processed",
) {
  const item = prepared(token);
  if (item.binding !== (await articleProjectKey(report)))
    throw new StorageConflict("图片预览属于其他项目。");
  const bytes = variant === "processed" ? item.processed : item.original;
  if (!bytes) throw new MediaError("处理后的图片不可用。");
  return bytes;
}
export async function commitMedia(
  report: ProjectReport,
  token: string,
  variant: "original" | "processed",
  stateDir?: string,
) {
  const item = prepared(token);
  if (item.busy) throw new StorageConflict("该图片正在上传，请等待完成。");
  item.busy = true;
  try {
    const preferences = await mediaPreferences(report, stateDir);
    if (preferences.readOnly) throw new MediaError("当前项目只读，不能上传图片。");
    if (
      preferences.projectKey !== item.binding ||
      contentVersion(JSON.stringify(preferences.values)) !== item.settings
    )
      throw new StorageConflict("项目或媒体设置已变化，请重新预览。");
    const bytes = variant === "processed" ? item.processed : item.original;
    const mediaPath =
      variant === "processed" ? item.overview.processedPath : item.overview.originalPath;
    if (!bytes || !mediaPath) throw new MediaError("处理后的图片不可用，尚未上传任何文件。");
    const reference = await uploadMedia(report, item.scope, mediaPath, bytes, item.articleId);
    preparations.delete(token);
    return { reference, size: bytes.length, fileName: path.posix.basename(mediaPath) };
  } finally {
    item.busy = false;
  }
}
