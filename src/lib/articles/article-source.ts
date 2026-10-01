export interface ArticleSourceParts {
  opening: string;
  yaml: string;
  closing: string;
  body: string;
  bodyStart: number;
  newline: "\n" | "\r\n";
}

/** Split the file without parsing or rewriting its Frontmatter. */
export function splitArticleSource(source: string): ArticleSourceParts | null {
  const match = /^(\uFEFF?---[ \t]*\r?\n)([\s\S]*?)(^---[ \t]*(?:\r?\n|$))/m.exec(source);
  if (!match || match.index !== 0) return null;

  const bodyStart = match[0].length;
  return {
    opening: match[1],
    yaml: match[2],
    closing: match[3],
    body: source.slice(bodyStart),
    bodyStart,
    newline: match[1].includes("\r\n") ? "\r\n" : "\n",
  };
}
