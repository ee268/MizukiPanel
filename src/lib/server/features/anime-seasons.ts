import type { ProjectReport } from "../project";
import { FeatureError } from "./errors";
import { locations, writable } from "./paths";
import { backupDir, optionalFile } from "./storage";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { assertManagedRealPath, resolveManagedPath } from "../path-guard";
import { readManagedFile, StorageConflict, writeManagedFile } from "../storage";
import { animeSeasonAuthor, removeAnimeSeasonFlags } from "../anime-season-format";
import { groupAnimeSeasons } from "../../../shared/anime-seasons";
import { moveToRecycleBin } from "../recycle-bin";
function seasonId(id: string): string {
  const normalized = id.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!/^\d{4}\/(1|4|7|10)月\.md$/.test(normalized))
    throw new FeatureError("季度路径必须使用 YYYY/1月.md、4月.md、7月.md 或 10月.md");
  return normalized;
}

export async function listAnimeSeasons(report: ProjectReport) {
  const place = locations(report);
  const root = resolveManagedPath(place.root, place.animes);
  const seasons: Array<{ id: string; version: string; size: number }> = [];
  const authors = new Map<string, string>();
  try {
    for (const year of await readdir(root, { withFileTypes: true })) {
      if (!year.isDirectory() || !/^\d{4}$/.test(year.name)) continue;
      for (const file of await readdir(path.join(root, year.name), { withFileTypes: true })) {
        if (!file.isFile() || !/^(1|4|7|10)月\.md$/.test(file.name)) continue;
        const id = `${year.name}/${file.name}`;
        const data = await readManagedFile(place.root, `${place.animes}/${id}`);
        seasons.push({ id, version: data.version, size: Buffer.byteLength(data.content) });
        authors.set(id, animeSeasonAuthor(data.content));
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const sorted = groupAnimeSeasons(seasons).flatMap((group) => [...group.items].reverse());
  const defaultAuthor = sorted.map((season) => authors.get(season.id) ?? "").find(Boolean) ?? "";
  return { report, seasons: sorted, defaultAuthor };
}

export async function readAnimeSeason(report: ProjectReport, id: string) {
  const place = locations(report);
  id = seasonId(id);
  const file = await readManagedFile(place.root, `${place.animes}/${id}`);
  return { report, id, content: file.content, version: file.version, readOnly: report.readOnly };
}

export async function saveAnimeSeason(
  report: ProjectReport,
  id: string,
  content: string,
  version: string,
) {
  const place = writable(report);
  id = seasonId(id);
  const relative = `${place.animes}/${id}`;
  const current = await optionalFile(place.root, relative);
  if ((current?.version ?? "") !== version)
    throw new StorageConflict("季度内容已在其他位置修改，请重新加载");
  try {
    content = removeAnimeSeasonFlags(content);
  } catch (error) {
    throw new FeatureError((error as Error).message);
  }
  const result = await writeManagedFile(
    place.root,
    relative,
    content,
    current?.version ?? null,
    backupDir(),
    { domain: "feature", projectRoot: report.root },
  );
  return { document: await readAnimeSeason(report, id), backupPath: result.backupPath };
}
export async function deleteAnimeSeason(report: ProjectReport, id: string, version: string) {
  const place = writable(report);
  id = seasonId(id);
  const relative = `${place.animes}/${id}`;
  const current = await readManagedFile(place.root, relative);
  if (current.version !== version) throw new StorageConflict("季度内容已变化，请重新加载");
  return moveToRecycleBin(
    place.root,
    relative,
    "features",
    {
      domain: "feature",
      projectRoot: report.root,
    },
    { version },
  );
}
