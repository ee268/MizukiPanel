import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, expect, it, vi } from "vitest";
import { processImage } from "../src/lib/server/image-processing";
import {
  commitMedia,
  mediaPreferences,
  prepareMedia,
  preparedImage,
  PREPARATION_TTL,
} from "../src/lib/server/media-preparation";
import { defaultValues, patchSettings, emptyDocument } from "../src/shared/panel-settings";
import { encodeMediaPath, imageReference, type MediaSettings } from "../src/shared/media-settings";
import { mediaPreviewUrl } from "../src/lib/articles/media-preview-url";
import {
  readPanelSettings,
  savePanelSettings,
  settingsProjectKey,
} from "../src/lib/server/panel-settings";
import type { ProjectReport } from "../src/lib/server/project";
import { StorageConflict } from "../src/lib/server/storage";
import { listMedia, readMedia } from "../src/lib/server/media";

const defaults = defaultValues("project").media as unknown as MediaSettings;
const directories: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const root of directories.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture(mode: "local" | "external" = "local") {
  const base = await mkdtemp(path.join(tmpdir(), "mizuki-media-processing-"));
  directories.push(base);
  const root = path.join(base, "site");
  const contentRoot = mode === "external" ? path.join(base, "content") : null;
  await mkdir(root);
  const posts = path.join(contentRoot ?? root, mode === "external" ? "posts" : "src/content/posts");
  await mkdir(path.join(posts, "nested"), { recursive: true });
  await writeFile(path.join(posts, "nested/one.md"), "# One\n");
  const report: ProjectReport = {
    root,
    requestedPath: root,
    contentRoot,
    mode,
    readOnly: false,
    warnings: [],
    mappings: [],
  };
  const stateDir = path.join(base, "state");
  const save = async (fields: Record<string, unknown>) =>
    savePanelSettings(
      {
        scope: "project",
        projectKey: await settingsProjectKey(root),
        group: "media",
        fields,
        version: (await readPanelSettings("project", await settingsProjectKey(root), stateDir))
          .version,
      },
      stateDir,
    );
  const prepare = async (
    bytes: Buffer,
    name = "photo.png",
    scope: "public" | "article" = "public",
    folder = "",
  ) => {
    const preferences = await mediaPreferences(report, stateDir);
    return prepareMedia(
      report,
      {
        name,
        bytes,
        scope,
        folder,
        articleId: scope === "article" ? "nested/one.md" : undefined,
        projectKey: preferences.projectKey,
        settingsVersion: preferences.settingsVersion,
      },
      stateDir,
    );
  };
  return { root, posts, report, stateDir, save, prepare };
}
const png = (width = 120, height = 60, alpha = 1) =>
  sharp({
    create: {
      width,
      height,
      channels: alpha === 1 ? 3 : 4,
      background: { r: 30, g: 150, b: 220, alpha },
    },
  })
    .png()
    .toBuffer();
it("keeps original bytes when processing is disabled, including metadata and source dimensions", async () => {
  const { report, stateDir, prepare, root } = await fixture();
  const source = await sharp(await png())
    .withExif({ IFD0: { Artist: "keep me" } })
    .png()
    .toBuffer();
  const preview = await prepare(source);
  expect(preview.status).toBe("original");
  expect(preview.originalPath).toBe("photo.png");
  expect(await readdir(root)).toEqual(["src"]);
  expect(await preparedImage(report, preview.token, "original")).toEqual(source);
  await commitMedia(report, preview.token, "original", stateDir);
  expect(await readFile(path.join(root, "public/images/photo.png"))).toEqual(source);
  await expect(commitMedia(report, preview.token, "original", stateDir)).rejects.toBeInstanceOf(
    StorageConflict,
  );
});
it("resizes proportionally without enlarging small images and preserves alpha in WebP", async () => {
  const source = await png(120, 60, 0.5);
  const output = await processImage(source, {
    ...defaults,
    resize: true,
    maxDimension: 64,
    compress: true,
    format: "webp",
  });
  expect(output.status).toBe("processed");
  expect(output.extension).toBe(".webp");
  expect([output.outputWidth, output.outputHeight]).toEqual([64, 32]);
  expect((await sharp(output.bytes!).metadata()).hasAlpha).toBe(true);
  const small = await processImage(await png(16, 8), {
    ...defaults,
    resize: true,
    maxDimension: 64,
  });
  expect([small.outputWidth, small.outputHeight]).toEqual([16, 8]);
});
it("applies EXIF orientation before sizing processed images", async () => {
  const source = await sharp(await png(120, 60))
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const output = await processImage(source, { ...defaults, resize: true, maxDimension: 64 });
  expect(output.status).toBe("processed");
  expect([output.outputWidth, output.outputHeight]).toEqual([32, 64]);
  expect((await sharp(output.bytes!).metadata()).orientation).toBeUndefined();
});
it("releases older previews at the cache bound without writing files", async () => {
  const { prepare, report, root } = await fixture();
  const source = await png();
  const first = await prepare(source);
  let last = first;
  for (let index = 0; index < 8; index += 1) last = await prepare(source, `photo-${index}.png`);
  await expect(preparedImage(report, first.token, "original")).rejects.toThrow("释放");
  expect(await preparedImage(report, last.token, "original")).toEqual(source);
  expect(await readdir(root)).toEqual(["src"]);
});
it.each(["png", "jpeg", "webp", "avif"] as const)(
  "creates a decodable %s image with an accurate extension",
  async (format) => {
    const result = await processImage(await png(20, 10), { ...defaults, compress: true, format });
    expect(result.status).toBe("processed");
    expect(result.extension).toBe(format === "jpeg" ? ".jpg" : `.${format}`);
    expect((await sharp(result.bytes!).metadata()).width).toBe(20);
  },
);
it("rejects lossy transparency removal and leaves the original available for explicit fallback", async () => {
  const { prepare, save, report, stateDir, root } = await fixture();
  await save({ format: "jpeg" });
  const source = await png(20, 10, 0.5);
  const preview = await prepare(source);
  expect(preview.status).toBe("failed");
  expect(preview.message).toContain("透明");
  expect(preview.processedPath).toBeNull();
  expect(await readdir(root)).toEqual(["src"]);
  await expect(commitMedia(report, preview.token, "processed", stateDir)).rejects.toThrow("不可用");
  await commitMedia(report, preview.token, "original", stateDir);
  expect(await readFile(path.join(root, "public/images/photo.png"))).toEqual(source);
});
it("preserves GIF, animated WebP, APNG and SVG instead of flattening frames or vectors", async () => {
  const red = await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } })
    .png()
    .toBuffer();
  const blue = await sharp({ create: { width: 4, height: 4, channels: 3, background: "blue" } })
    .png()
    .toBuffer();
  const gif = await sharp([red, blue], { join: { animated: true } })
    .gif({ delay: [100, 100], loop: 0 })
    .toBuffer();
  const webp = await sharp(gif, { animated: true }).webp().toBuffer();
  expect((await sharp(webp).metadata()).pages).toBeGreaterThan(1);
  const still = await png(4, 4);
  const actl = Buffer.concat([
    Buffer.from([0, 0, 0, 8]),
    Buffer.from("acTL"),
    Buffer.from([0, 0, 0, 2, 0, 0, 0, 0]),
    Buffer.alloc(4),
  ]);
  const apng = Buffer.concat([still.subarray(0, 33), actl, still.subarray(33)]);
  for (const bytes of [
    gif,
    webp,
    apng,
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'),
  ]) {
    const result = await processImage(bytes, {
      ...defaults,
      format: "jpeg",
      resize: true,
      compress: true,
    });
    expect(result.status).toBe("skipped");
    expect(result.bytes).toBeNull();
  }
});
it("reports decode and pixel-limit failures without producing output", async () => {
  const invalid = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(20)]);
  expect((await processImage(invalid, { ...defaults, compress: true })).status).toBe("failed");
  const oversized = await png(8000, 4001);
  const result = await processImage(oversized, { ...defaults, resize: true, maxDimension: 64 });
  expect(result.status).toBe("failed");
  expect(result.bytes).toBeNull();
  expect(result.message).toMatch(/pixel|像素/i);
}, 15000);
it.each(["local", "external"] as const)(
  "previews converted article media in %s mode and writes only the selected final file",
  async (mode) => {
    const { report, stateDir, prepare, save, posts, root } = await fixture(mode);
    await save({ format: "webp", compress: true, naming: "date", alt: "empty" });
    const preview = await prepare(await png(), "photo.png", "article", "assets");
    expect(preview.processedReference).toMatch(/^\.\/assets\/\d{4}-\d{2}-\d{2}-photo.webp$/);
    expect(preview.alt).toBe("");
    expect(await readdir(path.join(posts, "nested"))).toEqual(["one.md"]);
    const result = await commitMedia(report, preview.token, "processed", stateDir);
    expect(result.reference).toBe(preview.processedReference);
    expect(
      (await sharp(await readFile(path.join(posts, "nested", preview.processedPath!))).metadata())
        .format,
    ).toBe("webp");
    expect(await readdir(path.join(posts, "nested/assets"))).toHaveLength(1);
    if (mode === "external") expect(await readdir(root)).toEqual([]);
  },
);
it("rejects old previews after settings changes, read-only changes, cross-project use and expiration", async () => {
  const { prepare, save, report, stateDir } = await fixture();
  const other = await fixture();
  const preview = await prepare(await png());
  await expect(
    commitMedia(other.report, preview.token, "original", other.stateDir),
  ).rejects.toBeInstanceOf(StorageConflict);
  await expect(
    commitMedia({ ...report, readOnly: true }, preview.token, "original", stateDir),
  ).rejects.toThrow("只读");
  await save({ naming: "unique" });
  await expect(commitMedia(report, preview.token, "original", stateDir)).rejects.toBeInstanceOf(
    StorageConflict,
  );
  const fresh = await prepare(await png());
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + PREPARATION_TTL + 1);
  await expect(commitMedia(report, fresh.token, "original", stateDir)).rejects.toThrow("过期");
});
it("detects duplicates at preview and final commit, and refuses traversal or a missing article", async () => {
  const { prepare, report, stateDir, root, posts } = await fixture();
  const source = await png();
  const first = await prepare(source);
  const second = await prepare(source);
  await commitMedia(report, first.token, "original", stateDir);
  await expect(commitMedia(report, second.token, "original", stateDir)).rejects.toThrow("同名");
  const duplicate = await prepare(source);
  expect(duplicate.originalAvailable).toBe(false);
  expect(await readFile(path.join(root, "public/images/photo.png"))).toEqual(source);
  await expect(prepare(source, "evil.png", "public", "../escape")).rejects.toThrow("无效");
  await rm(path.join(posts, "nested/one.md"));
  await expect(prepare(source, "other.png", "article")).rejects.toThrow();
});
it("encodes special filenames for both Markdown and HTML, previews the correct file and tracks references", async () => {
  const { prepare, report, stateDir, posts } = await fixture();
  const name = "中文 # (图)%.png";
  const preview = await prepare(await png(), name);
  await commitMedia(report, preview.token, "original", stateDir);
  const reference = `/images/${encodeMediaPath(name)}`;
  expect(preview.originalReference).toBe(reference);
  expect(mediaPreviewUrl("nested/one.md", reference)).toBe(
    `/api/media/file?scope=public&path=${encodeURIComponent(name)}`,
  );
  const html = imageReference(reference, 'a "quote" <tag>', "html");
  expect(html).toContain("&quot;");
  expect(html).toContain("&lt;tag&gt;");
  await writeFile(
    path.join(posts, "nested/one.md"),
    html + "\n" + imageReference(reference, "alt [text]", "markdown"),
  );
  expect((await listMedia(report))[0].referencedBy).toEqual(["nested/one.md"]);
  expect((await readMedia(report, "public", name)).type).toBe("image/png");
});
it("validates media preferences, preserves compatible defaults and handles unique naming", async () => {
  expect(defaults.compress).toBe(false);
  expect(defaults.resize).toBe(false);
  expect(defaults.format).toBe("original");
  for (const fields of [
    { quality: 49 },
    { maxDimension: 1 },
    { folder: "a//b" },
    { folder: "CON" },
    { format: "tiff" },
  ])
    expect(() =>
      patchSettings(emptyDocument("project"), "project", "media", fields, "test"),
    ).toThrow();
  const { save, prepare } = await fixture();
  await save({ naming: "unique" });
  const first = await prepare(await png());
  const second = await prepare(await png());
  expect(first.originalPath).toMatch(/^[a-f0-9-]{36}\.png$/);
  expect(first.originalPath).not.toBe(second.originalPath);
});
