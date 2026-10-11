import type { ConfigDescriptor } from "../types";

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
