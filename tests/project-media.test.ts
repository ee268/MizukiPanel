import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  scanProjectMedia,
  projectMediaFolders,
  assertProjectMediaDirectory,
  deleteProjectImage,
} from "../src/lib/server/project-media";
import { mediaPreferences, prepareMedia, commitMedia } from "../src/lib/server/media-preparation";
import { readMedia } from "../src/lib/server/media";
import { savePanelSettings, settingsProjectKey } from "../src/lib/server/panel-settings";
import type { ProjectReport } from "../src/lib/server/project";
import { validMediaStorageFolder, matchesProjectImage } from "../src/shared/project-media";
const roots: string[] = [];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const base = await mkdtemp(path.join(tmpdir(), "mizuki-project-media-"));
  roots.push(base);
  const root = path.join(base, "project");
  await mkdir(root);
  const state = path.join(base, "state");
  await mkdir(state);
  const report: ProjectReport = {
    root,
    requestedPath: root,
    mode: "local",
    contentRoot: null,
    readOnly: false,
    mappings: [],
    warnings: [],
  };
  const file = async (relative: string, bytes: string | Buffer = png) => {
    const absolute = path.join(root, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);
    return absolute;
  };
  return { root, base, state, report, file };
}
it("finds source, documentation, root and public images grouped by absolute folders, excluding build outputs", async () => {
  const { root, report, file } = await fixture();
  for (const relative of [
    "logo.png",
    "docs/image/demo.png",
    "src/assets/avatar.png",
    "public/assets/banner.png",
    "src/content/posts/nested/cover.png",
    "public/favicon/favicon.ico",
  ])
    await file(relative);
  for (const relative of [
    "dist/copy.png",
    "build/copy.png",
    "node_modules/pkg/icon.png",
    ".git/object.png",
    ".astro/cache.png",
    ".local/preview.png",
    "custom-output/copy.png",
  ])
    await file(relative);
  await file("astro.config.mjs", 'export default { outDir: "./custom-output" };');
  const scan = await scanProjectMedia(report);
  expect(scan.media).toHaveLength(6);
  expect(scan.folders).toHaveLength(6);
  expect(scan.warnings).toEqual([]);
  expect(scan.media.find((item) => item.relativePath === "public/assets/banner.png")).toMatchObject(
    {
      folder: path.join(root, "public/assets"),
      reference: "/assets/banner.png",
      publicReference: true,
    },
  );
  expect(scan.media.find((item) => item.relativePath === "src/assets/avatar.png")).toMatchObject({
    reference: path.join(root, "src/assets/avatar.png"),
    publicReference: false,
  });
  expect(scan.media.every((item) => path.isAbsolute(item.path))).toBe(true);
  for (const directory of ["dist", "custom-output", "node_modules/pkg"])
    await expect(assertProjectMediaDirectory(report, path.join(root, directory))).rejects.toThrow();
});
it("tracks references from config, documentation and relative Markdown before deleting", async () => {
  const { root, report, file, state } = await fixture();
  const banner = await file("public/assets/banner.png");
  const doc = await file("docs/image/demo.png");
  const article = await file("src/content/posts/nested/assets/cover.png");
  await file("src/config/site.ts", 'export const config = { banner: "assets/banner.png" };');
  await file("README.md", "![示例](docs/image/demo.png)");
  await file("src/content/posts/nested/one.md", "![封面](./assets/cover.png)");
  const scan = await scanProjectMedia(report);
  expect(scan.media.find((item) => item.path === banner)?.referencedBy).toContain(
    "src/config/site.ts",
  );
  expect(scan.media.find((item) => item.path === doc)?.referencedBy).toContain("README.md");
  expect(scan.media.find((item) => item.path === article)?.referencedBy).toContain(
    "src/content/posts/nested/one.md",
  );
  await expect(deleteProjectImage(report, banner, state)).rejects.toThrow("引用");
  const unused = await file("public/assets/unused.png");
  const trash = await deleteProjectImage(report, unused, state);
  expect(await readFile(trash)).toEqual(png);
  await expect(readFile(unused)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(path.join(root, "README.md"), "utf8")).toBe("![示例](docs/image/demo.png)");
});
it("includes independent content images and deduplicates nested content roots", async () => {
  const { root, report, file } = await fixture();
  await file("public/assets/site.png");
  const contentRoot = path.join(root, "content");
  await file("content/images/album/photo.png");
  const scan = await scanProjectMedia({ ...report, mode: "external", contentRoot });
  expect(scan.media).toHaveLength(2);
  expect(scan.media.find((item) => item.path.startsWith(contentRoot))).toMatchObject({
    reference: "/images/album/photo.png",
    folder: path.join(contentRoot, "images/album"),
  });
});
it("previews and uploads to the exact absolute source folder with no unintended public/images fallback", async () => {
  const { root, report, state } = await fixture();
  const folder = path.join(root, "src/assets/new-gallery");
  const preferences = await mediaPreferences(report, state);
  const preview = await prepareMedia(
    report,
    {
      name: "new.png",
      bytes: png,
      scope: "project",
      folder,
      projectKey: preferences.projectKey,
      settingsVersion: preferences.settingsVersion,
    },
    state,
  );
  expect(preview.originalPath).toBe(path.join(folder, "new.png"));
  expect(preview.publicReference).toBe(false);
  await expect(readFile(preview.originalPath)).rejects.toMatchObject({ code: "ENOENT" });
  const result = await commitMedia(report, preview.token, "original", state);
  expect(result.reference).toBe(path.join(folder, "new.png"));
  expect(await readFile(path.join(folder, "new.png"))).toEqual(png);
  await expect(readFile(path.join(root, "public/images/new.png"))).rejects.toMatchObject({
    code: "ENOENT",
  });
  expect((await readMedia(report, "project", result.reference)).type).toBe("image/png");
});
it("validates absolute folders, project boundaries, read-only and file targets", async () => {
  const { root, base, report, file, state } = await fixture();
  const target = await file("public/assets/picture.png");
  const nonImage = await file("source.txt", png);
  await expect(readMedia(report, "project", nonImage)).rejects.toThrow("图片文件");
  expect(validMediaStorageFolder("C:\\project\\public\\assets")).toBe(true);
  expect(validMediaStorageFolder("/project/public/assets")).toBe(true);
  expect(validMediaStorageFolder("public/assets")).toBe(false);
  expect(
    matchesProjectImage(
      { path: "C:\\Mizuki\\public\\assets\\Projects\\图片.png" },
      "public/assets/projects",
    ),
  ).toBe(true);
  expect(matchesProjectImage({ path: "/Mizuki/public/assets/图片.png" }, "public\\assets")).toBe(
    true,
  );
  for (const folder of [
    path.join(base, "outside"),
    target,
    "public/assets",
    path.join(root, "dist"),
  ])
    await expect(assertProjectMediaDirectory(report, folder)).rejects.toThrow();
  await expect(deleteProjectImage({ ...report, readOnly: true }, target, state)).rejects.toThrow(
    "只读",
  );
  const outside = path.join(base, "outside");
  await mkdir(outside);
  const escaped = path.join(root, "escape");
  await symlink(outside, escaped, process.platform === "win32" ? "junction" : "dir");
  await expect(assertProjectMediaDirectory(report, escaped)).rejects.toThrow();
  expect((await scanProjectMedia(report)).media).toHaveLength(1);
});
it("restores public defaults and preserves new absolute storage preferences", async () => {
  const { root, report, state, file } = await fixture();
  await file("public/assets/banner.png");
  const defaults = await projectMediaFolders(report, {});
  expect(defaults.defaultFolder).toBe(path.join(root, "public/images"));
  expect(defaults.folders.some((folder) => folder.path === defaults.defaultFolder)).toBe(true);
  const folder = path.join(root, "public/assets");
  await savePanelSettings(
    {
      scope: "project",
      projectKey: await settingsProjectKey(root),
      group: "media",
      fields: { storageFolder: folder },
      version: null,
    },
    state,
  );
  expect(
    (await projectMediaFolders(report, (await mediaPreferences(report, state)).values))
      .defaultFolder,
  ).toBe(folder);
});
