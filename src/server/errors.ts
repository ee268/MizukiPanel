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

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 500,
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
    error instanceof WorkspacePickerError
  ) {
    throw new ApiError(400, error.message);
  }
  if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
    throw new ApiError(404, "目标文件不存在或已被移动");
  }
  throw error;
}
