import { readFile, readdir } from "node:fs/promises";
import { readConfig } from "./configs";
import { assertManagedRealPath } from "./path-guard";
import type { ProjectReport } from "./project";

export type EditorFontMode = "custom" | "system";
export type EditorFontName = "body" | "cjk" | "code";

const fontFiles = {
  body: "src/assets/fonts/ZenMaruGothic-Medium.woff2",
  cjk: "src/assets/fonts/loli.woff2",
} as const;

export async function readEditorFontMode(report: ProjectReport): Promise<EditorFontMode> {
  const site = await readConfig(report, "siteConfig");
  const config = site.effectiveValue;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return "custom";
  }
  const font = config.font;
  if (!font || typeof font !== "object" || Array.isArray(font)) {
    return "custom";
  }
  return font.mode === "system" ? "system" : "custom";
}

export async function readEditorFont(
  report: ProjectReport,
  name: EditorFontName,
): Promise<Buffer | null> {
  if (name === "code") {
    // Astro downloads this Fontsource variant into its local font cache.
    // If it has not been generated yet, the editor uses Mizuki's system mono fallback.
    const folder = await assertManagedRealPath(report.root, ".astro/fonts");
    const entries = await readdir(folder).catch(() => []);
    const filename = entries.find((entry) =>
      /^font-jetbrains-mono-400-normal-latin-[a-f0-9]+\.woff2$/i.test(entry),
    );
    return filename
      ? readFile(await assertManagedRealPath(report.root, `.astro/fonts/${filename}`))
      : null;
  }
  return readFile(await assertManagedRealPath(report.root, fontFiles[name]));
}
