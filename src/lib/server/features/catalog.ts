import { stat } from "node:fs/promises";
import { assertManagedRealPath } from "../path-guard";
import { patchConfigBoolean } from "../config-format";
import { readConfig, saveConfig } from "../configs";
import { StorageConflict } from "../storage";
import { FEATURE_DATA, modules, textResources } from "./registry";
import type { ProjectReport } from "../project";
import { FeatureError } from "./errors";
import { locations } from "./paths";
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
    siteConfigVersion: site.version,
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

export async function setFeatureEnabled(
  report: ProjectReport,
  key: string,
  enabled: boolean,
  expectedVersion: string,
) {
  const module = modules.find((item) => item.key === key);
  if (!module?.switchKey) throw new FeatureError("该特色页面未提供启用开关");
  if (typeof enabled !== "boolean") throw new FeatureError("页面开关必须为布尔值");
  if (report.readOnly || report.mode === "blocked")
    throw new FeatureError("当前工作区只读，无法修改页面开关");
  const current = await readConfig(report, "siteConfig");
  if (current.version !== expectedVersion)
    throw new StorageConflict("站点配置已在其他位置修改，请刷新后重试");
  const initializer = patchConfigBoolean(
    current.initializer,
    ["featurePages", module.switchKey],
    enabled,
  );
  if (initializer === current.initializer)
    return { key, enabled, siteConfigVersion: current.version };
  const saved = await saveConfig(report, "siteConfig", initializer, expectedVersion);
  return { key, enabled, siteConfigVersion: saved.config.version };
}
