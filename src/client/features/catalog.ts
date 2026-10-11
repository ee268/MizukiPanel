import type { FeatureModule } from "../types";
import { createSearchMatcher } from "../shared/search";

export function filterFeatureModules(modules: FeatureModule[], query: string) {
  const matchesText = createSearchMatcher(query);
  return modules.filter((item) => {
    return matchesText(`${item.label} ${item.key} ${item.pagePath}`);
  });
}
