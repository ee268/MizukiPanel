import { expect, it } from "vitest";
import { filterConfigGroups } from "../src/client/config/catalog";
import type { ConfigDescriptor } from "../src/client/types";

const groups: Record<string, ConfigDescriptor[]> = {
  站点与外观: [
    {
      key: "siteConfig",
      label: "站点核心",
      group: "站点与外观",
      file: "siteConfig.ts",
      exportName: "siteConfig",
    },
    {
      key: "fullscreenWallpaperConfig",
      label: "全屏壁纸",
      group: "站点与外观",
      file: "backgroundWallpaper.ts",
      exportName: "fullscreenWallpaperConfig",
    },
  ],
  互动与内容: [
    {
      key: "commentConfig",
      label: "评论系统",
      group: "互动与内容",
      file: "commentConfig.ts",
      exportName: "commentConfig",
    },
  ],
};

it("finds configurations by Chinese name, case-insensitive English name and source filename", () => {
  for (const query of ["全屏", "FULLSCREENWALLPAPER", "backgroundWallpaper.ts"])
    expect(
      filterConfigGroups(groups, query).flatMap((group) => group.items.map((item) => item.key)),
    ).toEqual(["fullscreenWallpaperConfig"]);
});

it("searches categories and combines multiple search terms", () => {
  expect(filterConfigGroups(groups, "站点与外观")[0].items).toHaveLength(2);
  expect(filterConfigGroups(groups, "  站点与外观   核心  ")[0].items[0].key).toBe("siteConfig");
  expect(filterConfigGroups(groups, "评论 外观")).toEqual([]);
  expect(filterConfigGroups(groups, ".* (nothing)")).toEqual([]);
});

it("retains group ordering and the complete source list while filtering", () => {
  const before = structuredClone(groups);
  expect(filterConfigGroups(groups, "").map((group) => group.group)).toEqual([
    "站点与外观",
    "互动与内容",
  ]);
  filterConfigGroups(groups, "评论");
  expect(groups).toEqual(before);
});
