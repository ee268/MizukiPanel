import type { ProjectImage } from "../../shared/project-media";

export const mediaImageUrl = (item: ProjectImage) =>
  `/api/media/file?scope=project&path=${encodeURIComponent(item.path)}`;

export const mediaImageName = (item: ProjectImage) => item.path.split(/[\\/]/).at(-1) ?? item.path;
