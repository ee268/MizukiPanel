import { ArticleValidationError } from "../lib/server/article-format";
import { ConfigValidationError } from "../lib/server/config-format";
import { SiteConfigError } from "../lib/server/configs";
import { FeatureError } from "../lib/server/features";
import { MediaError } from "../lib/server/media";
import { PathGuardError } from "../lib/server/path-guard";
import { ProjectError } from "../lib/server/project";
import { PublishError } from "../lib/server/publish";
import { StorageConflict } from "../lib/server/storage";
import { WorkspacePickerError } from "../lib/server/workspace";
import { WorkspaceError } from "../lib/server/workspace-session";
import { MaintenanceError } from "../lib/server/maintenance";
import { SettingsValidationError } from "../shared/panel-settings";
import { AiVaultError } from "../lib/server/ai-vault";
import { ConversationValidationError } from "../shared/ai-conversations";

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502 | 503 | 504,
    message: string,
  ) {
    super(message);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败";
}

export function mapError(error: unknown): never {
  if (error instanceof ApiError) {
    throw error;
  }
  if (error instanceof AiVaultError) throw new ApiError(error.status, error.message);
  if (error instanceof StorageConflict) {
    throw new ApiError(409, error.message);
  }
  if (
    error instanceof ArticleValidationError ||
    error instanceof ConfigValidationError ||
    error instanceof SiteConfigError ||
    error instanceof FeatureError ||
    error instanceof MediaError ||
    error instanceof PathGuardError ||
    error instanceof ProjectError ||
    error instanceof PublishError ||
    error instanceof WorkspacePickerError ||
    error instanceof WorkspaceError ||
    error instanceof MaintenanceError ||
    error instanceof SettingsValidationError ||
    error instanceof ConversationValidationError
  ) {
    throw new ApiError(400, error.message);
  }
  if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
    throw new ApiError(404, "目标文件不存在或已被移动");
  }
  if (["EACCES", "EPERM", "EROFS"].includes((error as NodeJS.ErrnoException)?.code ?? ""))
    throw new ApiError(403, "目录不可读写，请检查权限；操作未完成。");
  throw error;
}
