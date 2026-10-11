import type { ConfigDescriptor } from "../types";
import { createSearchMatcher } from "../shared/search";

export function filterConfigGroups(groups: Record<string, ConfigDescriptor[]>, query: string) {
  const matchesText = createSearchMatcher(query);
  return Object.entries(groups).flatMap(([group, items]) => {
    const matches = items.filter((item) => {
      return matchesText(`${item.label} ${item.key} ${item.group} ${item.file}`);
    });
    return matches.length ? [{ group, items: matches }] : [];
  });
}
