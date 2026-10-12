export interface AiDiffRow {
  before?: string;
  after?: string;
  beforeLine?: number;
  afterLine?: number;
  changed: boolean;
}
/** Bounded line comparison; large documents fall back to their common prefix/suffix. */
export function aiDiff(before: string, after: string): AiDiffRow[] {
  const a = before.replace(/\r\n?/g, "\n").split("\n"),
    b = after.replace(/\r\n?/g, "\n").split("\n");
  const operations: { kind: "same" | "remove" | "add"; text: string }[] = [];
  if (a.length * b.length <= 250000) {
    const table = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--)
        table[i][j] =
          a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    let i = 0,
      j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j])
        (operations.push({ kind: "same", text: a[i++] }), j++);
      else if (i < a.length && (j === b.length || table[i + 1][j] >= table[i][j + 1]))
        operations.push({ kind: "remove", text: a[i++] });
      else operations.push({ kind: "add", text: b[j++] });
    }
  } else {
    let prefix = 0,
      suffix = 0;
    while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
    while (
      suffix < a.length - prefix &&
      suffix < b.length - prefix &&
      a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
    )
      suffix++;
    for (const text of a.slice(0, prefix)) operations.push({ kind: "same", text });
    for (const text of a.slice(prefix, a.length - suffix))
      operations.push({ kind: "remove", text });
    for (const text of b.slice(prefix, b.length - suffix)) operations.push({ kind: "add", text });
    for (const text of a.slice(a.length - suffix)) operations.push({ kind: "same", text });
  }
  const rows: AiDiffRow[] = [];
  let oldLine = 1,
    newLine = 1;
  for (let i = 0; i < operations.length;) {
    const op = operations[i];
    if (op.kind === "same") {
      rows.push({
        before: op.text,
        after: op.text,
        beforeLine: oldLine++,
        afterLine: newLine++,
        changed: false,
      });
      i++;
      continue;
    }
    const removed: string[] = [],
      added: string[] = [];
    while (i < operations.length && operations[i].kind !== "same") {
      const item = operations[i++];
      (item.kind === "remove" ? removed : added).push(item.text);
    }
    for (let j = 0; j < Math.max(removed.length, added.length); j++)
      rows.push({
        before: removed[j],
        after: added[j],
        beforeLine: j < removed.length ? oldLine++ : undefined,
        afterLine: j < added.length ? newLine++ : undefined,
        changed: true,
      });
  }
  return rows;
}
