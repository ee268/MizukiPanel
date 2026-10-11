/** Match every whitespace-separated query term, without changing domain-specific search fields. */
export function createSearchMatcher(query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return (text: string) => {
    const normalized = text.toLocaleLowerCase();
    return terms.every((term) => normalized.includes(term));
  };
}
