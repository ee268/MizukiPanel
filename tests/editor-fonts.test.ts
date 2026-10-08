import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { readEditorFont, readEditorFontMode } from "../src/lib/server/editor-fonts";
import type { ProjectReport } from "../src/lib/server/project";

it("uses the connected Mizuki font mode and its local font files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-editor-fonts-"));
  try {
    const contentRoot = path.join(root, "content");
    await mkdir(path.join(root, "src/config"), { recursive: true });
    await mkdir(path.join(root, "src/assets/fonts"), { recursive: true });
    await mkdir(path.join(contentRoot, "overrides"), { recursive: true });
    await writeFile(
      path.join(root, "src/config/siteConfig.ts"),
      'export const siteConfig = { font: { mode: "custom" } };',
    );
    await writeFile(path.join(root, "src/assets/fonts/ZenMaruGothic-Medium.woff2"), "body");
    await writeFile(path.join(root, "src/assets/fonts/loli.woff2"), "cjk");
    const report: ProjectReport = {
      requestedPath: root,
      root,
      mode: "local",
      readOnly: false,
      contentRoot: null,
      warnings: [],
      mappings: [],
    };
    expect(await readEditorFontMode(report)).toBe("custom");
    expect((await readEditorFont(report, "body"))?.toString()).toBe("body");
    expect((await readEditorFont(report, "cjk"))?.toString()).toBe("cjk");
    await writeFile(
      path.join(contentRoot, "overrides/siteConfig.ts"),
      'export default { font: { mode: "system" } };',
    );
    expect(await readEditorFontMode({ ...report, mode: "external", contentRoot })).toBe("system");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
