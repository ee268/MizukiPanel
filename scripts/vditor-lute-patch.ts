// CommonMark opening-tag grammar: whitespace separates attributes, but remains
// valid inside quoted values. Lute bundled with Vditor 4.0.0 splits those values.
const openingTag =
  /^<[A-Za-z][A-Za-z0-9-]*(?:[ \t\r\n]+[A-Za-z_:][A-Za-z0-9_.:-]*(?:[ \t\r\n]*=[ \t\r\n]*(?:"[^"]*"|'[^']*'|[^ \t\r\n"'=<>\x60]+))?)*[ \t\r\n]*\/?>$/;

/** Patch the served copy only, keeping the locked dependency and Markdown intact. */
export function patchVditorLute(source: string): string {
  const functionBody =
    /(\$ptrType\([\w$]+\)\.prototype\.isOpenTag=)function [\w$]+\([\w$]+\)\{[\s\S]*?(?=;\$ptrType\([\w$]+\)\.prototype\.isCloseTag=)/g;
  const matches = [...source.matchAll(functionBody)];
  if (matches.length !== 1 || !matches[0][0].includes(".SplitWhitespace(")) {
    throw new Error("Vditor Lute HTML patch no longer matches; review it before upgrading Vditor.");
  }
  return source.replace(
    functionBody,
    (_, prefix: string) =>
      `${prefix}function(tokens){return /${openingTag.source}/.test($bytesToString(tokens));}`,
  );
}
