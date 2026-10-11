import type { FeatureModule } from "../types";

export function filterFeatureModules(modules: FeatureModule[], query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return modules.filter((item) => {
    const text = `${item.label} ${item.key} ${item.pagePath}`.toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
