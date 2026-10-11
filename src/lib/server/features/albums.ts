import type { ProjectReport } from "../project";
import { FeatureError } from "./errors";
import { locations, writable } from "./paths";
import { backupDir, optionalFile } from "./storage";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { assertManagedRealPath, resolveManagedPath } from "../path-guard";
import { readManagedFile, StorageConflict, writeManagedFile } from "../storage";
import { validateUrl } from "./validation";
import { copyToTrash } from "./storage";
function albumId(id: string) {
  const value = id.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value))
    throw new FeatureError("相册 ID 只能包含字母、数字、下划线和连字符，最长 64 个字符");
  return value;
}

function validateAlbum(info: Record<string, unknown>) {
  if (typeof info.title !== "string" || !info.title.trim())
    throw new FeatureError("相册标题不能为空");
  if (info.date && (typeof info.date !== "string" || Number.isNaN(Date.parse(info.date))))
    throw new FeatureError("相册日期无效");
  if (info.layout && !["grid", "masonry"].includes(String(info.layout)))
    throw new FeatureError("相册布局必须是 grid 或 masonry");
  if (
    info.columns &&
    (!Number.isInteger(info.columns) || Number(info.columns) < 2 || Number(info.columns) > 4)
  )
    throw new FeatureError("相册列数必须是 2–4");
  if (info.mode === "external") {
    if (typeof info.cover !== "string") throw new FeatureError("外链相册必须提供 cover");
    validateUrl(info.cover, "cover");
    if (!Array.isArray(info.photos)) throw new FeatureError("外链相册必须提供 photos 数组");
    for (const [index, photo] of info.photos.entries()) {
      if (
        !photo ||
        typeof photo !== "object" ||
        Array.isArray(photo) ||
        typeof photo.src !== "string"
      )
        throw new FeatureError(`第 ${index + 1} 张外链照片缺少 src`);
      validateUrl(photo.src, `photos[${index}].src`);
    }
  }
}

export async function listAlbums(report: ProjectReport) {
  const place = locations(report);
  const base = resolveManagedPath(place.root, place.albums);
  const albums: Array<{
    id: string;
    info: Record<string, unknown>;
    version: string;
    photos: string[];
    complete: boolean;
  }> = [];
  try {
    for (const entry of await readdir(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const relative = `${place.albums}/${entry.name}/info.json`;
      const file = await optionalFile(place.root, relative);
      if (!file) continue;
      let info: Record<string, unknown>;
      try {
        info = JSON.parse(file.content) as Record<string, unknown>;
      } catch {
        info = { title: entry.name, error: "info.json 格式错误" };
      }
      const files = await readdir(path.join(base, entry.name), { withFileTypes: true });
      const photos = files
        .filter((item) => item.isFile() && /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(item.name))
        .map((item) => item.name);
      const complete =
        info.mode === "external"
          ? typeof info.cover === "string" && Array.isArray(info.photos)
          : photos.some((name) => /^cover\.(jpg|webp)$/i.test(name));
      albums.push({ id: entry.name, info, version: file.version, photos, complete });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return { report, albums: albums.sort((a, b) => a.id.localeCompare(b.id)) };
}

export async function saveAlbum(
  report: ProjectReport,
  id: string,
  info: Record<string, unknown>,
  version: string,
) {
  const place = writable(report);
  id = albumId(id);
  validateAlbum(info);
  const relative = `${place.albums}/${id}/info.json`;
  const current = await optionalFile(place.root, relative);
  if ((current?.version ?? "") !== version)
    throw new StorageConflict("相册信息已在其他位置修改，请重新加载");
  const result = await writeManagedFile(
    place.root,
    relative,
    JSON.stringify(info, null, "\t") + "\n",
    current?.version ?? null,
    backupDir(),
    { domain: "feature", projectRoot: report.root },
  );
  return { albums: await listAlbums(report), backupPath: result.backupPath };
}

export async function deleteAlbum(report: ProjectReport, id: string, version: string) {
  const place = writable(report);
  id = albumId(id);
  const relative = `${place.albums}/${id}`;
  const info = await readManagedFile(place.root, `${relative}/info.json`);
  if (info.version !== version) throw new StorageConflict("相册信息已变化，请重新加载");
  return copyToTrash(
    await assertManagedRealPath(place.root, relative),
    id,
    report,
    place.root,
    relative,
  );
}
