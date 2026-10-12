import type { AiDiffRow } from "./ai-diff";
export function diffPreview(rows: AiDiffRow[], limit = 600) {
  const preview: (AiDiffRow | { gap: number })[] = [];
  let gap = 0,
    shown = 0,
    truncated = false;
  for (let i = 0; i < rows.length; i++) {
    const visible = rows.slice(Math.max(0, i - 3), i + 4).some((row) => row.changed);
    if (!visible) {
      gap++;
      continue;
    }
    if (shown >= limit) {
      truncated = true;
      break;
    }
    if (gap) {
      preview.push({ gap });
      gap = 0;
    }
    preview.push(rows[i]);
    shown++;
  }
  if (gap) preview.push({ gap });
  return { rows: preview, truncated };
}
