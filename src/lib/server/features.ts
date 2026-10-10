import { constants } from "node:fs";
import { cp, lstat, mkdir, readdir, readFile, rm, stat, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { recordArchive, archiveSnapshot } from "./archive-metadata";
import path from "node:path";
import type { ProjectReport } from "./project";
import { assertManagedRealPath, resolveManagedPath } from "./path-guard";
import { defaultStateDir } from "./workspace";
import {
  contentVersion,
  readManagedFile,
  restoreManagedFile,
  StorageConflict,
  writeManagedFile,
} from "./storage";
import {
  parseConfigInitializer,
  replaceConfigInitializer,
  type ConfigValue,
} from "./config-format";
import { readConfig } from "./configs";

export class FeatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeatureError";
  }
}

export interface FeatureDataDescriptor {
  key: string;
  module: string;
  label: string;
  file: string;
  variable: string;
  shape: "array" | "object";
}

export const FEATURE_DATA: readonly FeatureDataDescriptor[] = [
  {
    key: "friends",
    module: "friends",
    label: "友链列表",
    file: "friends.ts",
    variable: "friendsData",
    shape: "array",
  },
  {
    key: "diary",
    module: "diary",
    label: "日记条目",
    file: "diary.ts",
    variable: "diaryData",
    shape: "array",
  },
  {
    key: "anime",
    module: "anime",
    label: "本地追番列表",
    file: "anime.ts",
    variable: "localAnimeList",
    shape: "array",
  },
  {
    key: "projects",
    module: "projects",
    label: "项目列表",
    file: "projects.ts",
    variable: "projectsData",
    shape: "array",
  },
  {
    key: "skills",
    module: "skills",
    label: "技能列表",
    file: "skills.ts",
    variable: "skillsData",
    shape: "array",
  },
  {
    key: "devices",
    module: "devices",
    label: "设备分组",
    file: "devices.ts",
    variable: "devicesData",
    shape: "object",
  },
  {
    key: "timeline",
    module: "timeline",
    label: "时间线",
    file: "timeline.ts",
    variable: "timelineData",
    shape: "array",
  },
  {
    key: "aiTools",
    module: "aiTools",
    label: "AI 工具",
    file: "ai-tools.ts",
    variable: "aiToolsData",
    shape: "array",
  },
];

const modules = [
  { key: "about", label: "关于", pagePath: "/about/", switchKey: null, resources: ["aboutText"] },
  {
    key: "friends",
    label: "友链",
    pagePath: "/friends/",
    switchKey: "friends",
    resources: ["friends"],
  },
  { key: "diary", label: "日记", pagePath: "/diary/", switchKey: "diary", resources: ["diary"] },
  {
    key: "anime",
    label: "追番",
    pagePath: "/anime/",
    switchKey: "anime",
    resources: ["anime"],
  },
  {
    key: "albums",
    label: "相册",
    pagePath: "/albums/",
    switchKey: "albums",
    resources: ["albums"],
  },
  {
    key: "projects",
    label: "项目",
    pagePath: "/projects/",
    switchKey: "projects",
    resources: ["projects"],
  },
  {
    key: "skills",
    label: "技能",
    pagePath: "/skills/",
    switchKey: "skills",
    resources: ["skills"],
  },
  {
    key: "devices",
    label: "设备",
    pagePath: "/devices/",
    switchKey: "devices",
    resources: ["devices"],
  },
  {
    key: "timeline",
    label: "时间线",
    pagePath: "/timeline/",
    switchKey: "timeline",
    resources: ["timeline"],
  },
  {
    key: "aiTools",
    label: "AI 工具",
    pagePath: "/ai-tools/",
    switchKey: "aiTools",
    resources: ["aiTools"],
  },
] as const;

const textResources = {
  aboutText: { label: "关于正文", relative: "spec/about.md" },
  friendsText: { label: "友链说明", relative: "spec/friends.md" },
} as const;

const backupDir = () => path.join(defaultStateDir(), "backups");
const trashDir = () => path.join(defaultStateDir(), "trash", "features");

function writable(report: ProjectReport) {
  if (report.readOnly || report.mode === "blocked")
    throw new FeatureError("当前工作区只读，无法修改特色页");
  return report.mode === "external"
    ? {
        root: report.contentRoot!,
        data: "data",
        spec: "spec",
        animes: "animes",
        albums: "images/albums",
      }
    : {
        root: report.root,
        data: "src/data",
        spec: "src/content/spec",
        animes: "src/content/animes",
        albums: "public/images/albums",
      };
}

function locations(report: ProjectReport) {
  return report.mode === "external"
    ? {
        root: report.contentRoot!,
        data: "data",
        spec: "spec",
        animes: "animes",
        albums: "images/albums",
      }
    : {
        root: report.root,
        data: "src/data",
        spec: "src/content/spec",
        animes: "src/content/animes",
        albums: "public/images/albums",
      };
}

function dataDescriptor(key: string) {
  const item = FEATURE_DATA.find((entry) => entry.key === key);
  if (!item) throw new FeatureError("未知的特色页数据源");
  return item;
}

function textDescriptor(key: string): (typeof textResources)[keyof typeof textResources] {
  if (!(key in textResources)) throw new FeatureError("未知的特色页正文");
  return textResources[key as keyof typeof textResources];
}

function hasExpression(value: ConfigValue): boolean {
  if (typeof value === "string") return value.startsWith("«expression:");
  if (Array.isArray(value)) return value.some(hasExpression);
  return Boolean(value && typeof value === "object" && Object.values(value).some(hasExpression));
}

function validateUrl(value: string, field: string) {
  if (!value || value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) return;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new FeatureError(`${field} 必须是 http(s) URL 或站点相对路径`);
  }
}

function validateValue(value: ConfigValue, pathLabel = ""): void {
  if (Array.isArray(value)) {
    const ids = new Set<string>();
    for (const [index, item] of value.entries()) {
      if (item && typeof item === "object" && !Array.isArray(item) && typeof item.id === "string") {
        if (ids.has(item.id))
          throw new FeatureError(`${pathLabel || "列表"}存在重复 id：${item.id}`);
        ids.add(item.id);
      }
      validateValue(item, `${pathLabel}[${index}]`);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const field = pathLabel ? `${pathLabel}.${key}` : key;
    if (
      typeof child === "string" &&
      [
        "url",
        "siteurl",
        "imgurl",
        "image",
        "cover",
        "src",
        "thumbnail",
        "link",
        "liveDemo",
        "sourceCode",
        "visitUrl",
      ].includes(key)
    )
      validateUrl(child, field);
    if (
      typeof child === "string" &&
      ["date", "startDate", "endDate"].includes(key) &&
      child &&
      Number.isNaN(Date.parse(child))
    )
      throw new FeatureError(`${field} 不是有效日期`);
    validateValue(child, field);
  }
}

async function optionalFile(root: string, relative: string) {
  try {
    return await readManagedFile(root, relative);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function featureIndex(report: ProjectReport) {
  const site = await readConfig(report, "siteConfig");
  const nav = await readConfig(report, "navBarConfig");
  const place = locations(report);
  let hasAnimeSeasons = false;
  try {
    const directory = await assertManagedRealPath(place.root, place.animes);
    // Keep the custom editor available even after its last season has been deleted.
    hasAnimeSeasons = (await stat(directory)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const siteObject =
    site.effectiveValue &&
    typeof site.effectiveValue === "object" &&
    !Array.isArray(site.effectiveValue)
      ? site.effectiveValue
      : {};
  const switches =
    siteObject.featurePages &&
    typeof siteObject.featurePages === "object" &&
    !Array.isArray(siteObject.featurePages)
      ? siteObject.featurePages
      : {};
  const navText = JSON.stringify(nav.effectiveValue);
  return {
    report,
    modules: modules.map((item) => {
      const anime =
        siteObject.anime && typeof siteObject.anime === "object" && !Array.isArray(siteObject.anime)
          ? siteObject.anime
          : {};
      const diaryApi = typeof siteObject.diaryApiUrl === "string" ? siteObject.diaryApiUrl : "";
      const sourceMode =
        item.key === "diary"
          ? diaryApi
            ? "memos"
            : "local"
          : item.key === "anime"
            ? String(anime.mode ?? "local")
            : undefined;
      return {
        ...item,
        resources: item.key === "anime" && hasAnimeSeasons ? ["animeSeasons"] : item.resources,
        enabled: item.switchKey ? switches[item.switchKey] !== false : true,
        navigationConfigured:
          navText.includes(item.pagePath) ||
          navText.includes(
            `LinkPreset.${item.key === "aiTools" ? "AITools" : item.key[0].toUpperCase() + item.key.slice(1)}`,
          ),
        ...(sourceMode
          ? {
              sourceMode,
              sourceStatus:
                item.key === "diary" && diaryApi
                  ? `Memos API：${diaryApi}`
                  : `当前数据源：${sourceMode}`,
            }
          : {}),
      };
    }),
    dataResources: FEATURE_DATA,
    textResources: Object.entries(textResources).map(([key, value]) => ({ key, ...value })),
  };
}

export async function readFeatureData(report: ProjectReport, key: string) {
  const item = dataDescriptor(key);
  const place = locations(report);
  const relative = `${place.data}/${item.file}`;
  const file = await readManagedFile(place.root, relative);
  const parsed = parseConfigInitializer(file.content, item.variable, item.shape);
  const expression = hasExpression(parsed.value);
  return {
    report,
    descriptor: item,
    value: parsed.value,
    version: file.version,
    sourcePath: resolveManagedPath(place.root, relative),
    readOnly: report.readOnly || expression,
    warnings: expression ? ["数据包含枚举或代码表达式，面板为避免破坏源码已切换为只读。"] : [],
  };
}

export async function saveFeatureData(
  report: ProjectReport,
  key: string,
  value: ConfigValue,
  version: string,
) {
  const place = writable(report);
  const item = dataDescriptor(key);
  if (item.shape === "array" && !Array.isArray(value))
    throw new FeatureError(`${item.label}必须是数组`);
  if (item.shape === "object" && (!value || typeof value !== "object" || Array.isArray(value)))
    throw new FeatureError(`${item.label}必须是对象`);
  validateValue(value, item.key);
  const relative = `${place.data}/${item.file}`;
  const current = await readManagedFile(place.root, relative);
  if (current.version !== version)
    throw new StorageConflict("特色页数据已在其他位置修改，请重新加载");
  const initializer = JSON.stringify(value, null, "\t");
  const source = replaceConfigInitializer(current.content, item.variable, initializer, item.shape);
  const result = await writeManagedFile(place.root, relative, source, version, backupDir(), {
    domain: "feature",
    projectRoot: report.root,
  });
  return { document: await readFeatureData(report, key), backupPath: result.backupPath };
}

export async function readFeatureText(report: ProjectReport, key: string) {
  const item = textDescriptor(key);
  const place = locations(report);
  const relative = report.mode === "external" ? item.relative : `src/content/${item.relative}`;
  const file = await optionalFile(place.root, relative);
  return {
    report,
    key,
    label: item.label,
    content: file?.content ?? "",
    version: file?.version ?? "",
    exists: Boolean(file),
    readOnly: report.readOnly,
  };
}

export async function saveFeatureText(
  report: ProjectReport,
  key: string,
  content: string,
  version: string,
) {
  const item = textDescriptor(key);
  const place = writable(report);
  const relative = report.mode === "external" ? item.relative : `src/content/${item.relative}`;
  const current = await optionalFile(place.root, relative);
  if ((current?.version ?? "") !== version)
    throw new StorageConflict("正文已在其他位置修改，请重新加载");
  const result = await writeManagedFile(
    place.root,
    relative,
    content,
    current?.version ?? null,
    backupDir(),
    { domain: "feature", projectRoot: report.root },
  );
  return { document: await readFeatureText(report, key), backupPath: result.backupPath };
}

export async function restoreFeatureFile(
  report: ProjectReport,
  kind: "data" | "text",
  key: string,
  backupPath: string,
  version: string,
) {
  const place = writable(report);
  let relative: string;
  if (kind === "data") relative = `${place.data}/${dataDescriptor(key).file}`;
  else {
    const item = textDescriptor(key);
    relative = report.mode === "external" ? item.relative : `src/content/${item.relative}`;
  }
  await restoreManagedFile(place.root, relative, backupPath, version, backupDir(), {
    domain: "feature",
    projectRoot: report.root,
  });
  return kind === "data" ? readFeatureData(report, key) : readFeatureText(report, key);
}

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
  try {
    for (const year of await readdir(root, { withFileTypes: true })) {
      if (!year.isDirectory() || !/^\d{4}$/.test(year.name)) continue;
      for (const file of await readdir(path.join(root, year.name), { withFileTypes: true })) {
        if (!file.isFile() || !/^(1|4|7|10)月\.md$/.test(file.name)) continue;
        const id = `${year.name}/${file.name}`;
        const data = await readManagedFile(place.root, `${place.animes}/${id}`);
        seasons.push({ id, version: data.version, size: Buffer.byteLength(data.content) });
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return { report, seasons: seasons.sort((a, b) => b.id.localeCompare(a.id, "zh-CN")) };
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
  if (!/^---[ \t]*\r?\n/.test(content)) throw new FeatureError("季度内容必须包含 YAML Frontmatter");
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

async function copyToTrash(
  source: string,
  name: string,
  report: ProjectReport,
  root: string,
  relative: string,
) {
  const target = path.join(trashDir(), `${randomUUID()}-${name}`);
  await mkdir(path.dirname(target), { recursive: true });
  const stat = await lstat(source);
  const before = await archiveSnapshot(source);
  if (stat.isDirectory())
    await cp(source, target, {
      recursive: true,
      errorOnExist: true,
      force: false,
      mode: constants.COPYFILE_EXCL,
    });
  else
    await cp(source, target, { errorOnExist: true, force: false, mode: constants.COPYFILE_EXCL });
  try {
    const metadata = await recordArchive(target, "trash", root, relative, {
      domain: "feature",
      projectRoot: report.root,
    });
    if (
      metadata.digest !== before.digest ||
      (await archiveSnapshot(source)).digest !== before.digest
    )
      throw new StorageConflict("回收期间内容发生变化，请重试。");
    stat.isDirectory() ? await rm(source, { recursive: true }) : await unlink(source);
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    await rm(target + ".meta.json", { force: true });
    throw error;
  }
  return target;
}

export async function deleteAnimeSeason(report: ProjectReport, id: string, version: string) {
  const place = writable(report);
  id = seasonId(id);
  const relative = `${place.animes}/${id}`;
  const current = await readManagedFile(place.root, relative);
  if (current.version !== version) throw new StorageConflict("季度内容已变化，请重新加载");
  return copyToTrash(
    await assertManagedRealPath(place.root, relative),
    path.basename(id),
    report,
    place.root,
    relative,
  );
}

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
