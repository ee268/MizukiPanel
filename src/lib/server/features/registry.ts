import type { FeatureDataDescriptor } from "../../../shared/features";
export type { FeatureDataDescriptor } from "../../../shared/features";
import { FeatureError } from "./errors";

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

export const modules = [
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

export const textResources = {
  aboutText: { label: "关于正文", relative: "spec/about.md" },
  friendsText: { label: "友链说明", relative: "spec/friends.md" },
} as const;
export function dataDescriptor(key: string) {
  const item = FEATURE_DATA.find((entry) => entry.key === key);
  if (!item) throw new FeatureError("未知的特色页数据源");
  return item;
}

export function textDescriptor(key: string): (typeof textResources)[keyof typeof textResources] {
  if (!(key in textResources)) throw new FeatureError("未知的特色页正文");
  return textResources[key as keyof typeof textResources];
}
