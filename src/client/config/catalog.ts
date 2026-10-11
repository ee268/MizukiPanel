import type { ConfigDescriptor } from "../types";

export type ConfigDetailLayout = "focus" | "workbench" | "tabs";
export const configDetailLayouts: Array<{
  value: ConfigDetailLayout;
  label: string;
  description: string;
}> = [
  { value: "focus", label: "专注编辑", description: "宽幅编辑区域，备份放在下方。" },
  { value: "workbench", label: "双栏工作台", description: "编辑与备份并排，适合宽屏。" },
  { value: "tabs", label: "分区标签", description: "通过标签切换编辑和备份，界面更紧凑。" },
];

export function filterConfigGroups(groups: Record<string, ConfigDescriptor[]>, query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return Object.entries(groups).flatMap(([group, items]) => {
    const matches = items.filter((item) => {
      const text = `${item.label} ${item.key} ${item.group} ${item.file}`.toLocaleLowerCase();
      return terms.every((term) => text.includes(term));
    });
    return matches.length ? [{ group, items: matches }] : [];
  });
}
