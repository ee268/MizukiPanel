import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { moveToRecycleBin, RECYCLE_DIRECTORY } from "../src/lib/server/recycle-bin";
import { contentVersion } from "../src/lib/server/storage";
import { defaultStateDir } from "../src/lib/server/workspace";
import { withWorkspaceState } from "../src/lib/server/workspace-state";

vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof fs>();
  return { ...actual, rename: vi.fn(actual.rename), writeFile: vi.fn(actual.writeFile) };
});
const roots: string[] = [];
afterEach(async () => {
  vi.mocked(fs.rename).mockReset();
  vi.mocked(fs.writeFile).mockReset();
  const actual = await vi.importActual<typeof fs>("node:fs/promises");
  vi.mocked(fs.rename).mockImplementation(actual.rename);
  vi.mocked(fs.writeFile).mockImplementation(actual.writeFile);
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await fs.mkdtemp(path.join(tmpdir(), "mizuki-recycle-test-"));
  roots.push(root);
  const source = path.join(root, "article.md");
  const state = path.join(root, "state");
  await fs.writeFile(source, "original");
  const recycle = () =>
    moveToRecycleBin(
      root,
      "article.md",
      "articles",
      {
        domain: "article",
        projectRoot: root,
      },
      { stateDir: state, version: contentVersion("original") },
    );
  return { root, source, state, recycle };
}
it("moves the original file into the dedicated directory and records its recovery location", async () => {
  const { root, source, state, recycle } = await fixture();
  const original = await fs.stat(source);
  const target = await recycle();
  expect(path.relative(state, target).replaceAll(path.sep, "/")).toMatch(
    /^recycle-bin\/articles\//,
  );
  await expect(fs.access(source)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await fs.readFile(target, "utf8")).toBe("original");
  expect((await fs.stat(target)).ino).toBe(original.ino);
  expect(JSON.parse(await fs.readFile(target + ".meta.json", "utf8"))).toMatchObject({
    kind: "trash",
    domain: "article",
    relative: "article.md",
    bytes: 8,
    directory: false,
  });
  await expect(fs.access(path.join(root, "article.md.mizuki-panel.lock"))).rejects.toThrow();
});
it("preserves the original on stale versions, active locks, or failed indexing/moving", async () => {
  const { root, source, state, recycle } = await fixture();
  await fs.writeFile(source, "changed");
  await expect(recycle()).rejects.toThrow("已改变");
  await fs.writeFile(source, "original");
  await fs.writeFile(source + ".mizuki-panel.lock", "busy");
  await expect(recycle()).rejects.toThrow("其他操作");
  await fs.rm(source + ".mizuki-panel.lock");
  vi.mocked(fs.writeFile).mockRejectedValueOnce(
    Object.assign(new Error("index denied"), { code: "EACCES" }),
  );
  await expect(recycle()).rejects.toThrow("index denied");
  expect(await fs.readFile(source, "utf8")).toBe("original");
  vi.mocked(fs.rename).mockRejectedValueOnce(
    Object.assign(new Error("move denied"), { code: "EACCES" }),
  );
  await expect(recycle()).rejects.toThrow("move denied");
  expect(await fs.readFile(source, "utf8")).toBe("original");
  expect(await fs.readdir(path.join(state, RECYCLE_DIRECTORY, "articles"))).toEqual([]);
  expect(root).not.toBe(defaultStateDir());
});
it("falls back to a verified move for files on another volume", async () => {
  const { source, recycle } = await fixture();
  vi.mocked(fs.rename).mockRejectedValueOnce(
    Object.assign(new Error("other volume"), { code: "EXDEV" }),
  );
  const target = await recycle();
  expect(await fs.readFile(target, "utf8")).toBe("original");
  await expect(fs.access(source)).rejects.toThrow();
});
it("moves a complete directory, preserving nested images as a single recycle item", async () => {
  const { root, state } = await fixture();
  await fs.mkdir(path.join(root, "album/nested"), { recursive: true });
  await fs.writeFile(path.join(root, "album/info.json"), "{}");
  await fs.writeFile(path.join(root, "album/nested/image.png"), Buffer.from([0, 1, 255]));
  const target = await moveToRecycleBin(
    root,
    "album",
    "features",
    {
      domain: "feature",
      projectRoot: root,
    },
    { stateDir: state, version: contentVersion("{}"), versionFile: "album/info.json" },
  );
  expect(await fs.readFile(path.join(target, "nested/image.png"))).toEqual(
    Buffer.from([0, 1, 255]),
  );
  expect(JSON.parse(await fs.readFile(target + ".meta.json", "utf8"))).toMatchObject({
    directory: true,
    bytes: 5,
  });
  await expect(fs.access(path.join(root, "album"))).rejects.toThrow();
});
it("isolates implicit test storage and honors explicitly selected workspace storage", async () => {
  const state = defaultStateDir();
  expect(state).toBe(process.env.MIZUKI_PANEL_TEST_STATE_DIR);
  expect(state).not.toBe(path.resolve(process.cwd(), ".local"));
  const { root } = await fixture();
  const target = await moveToRecycleBin(root, "article.md", "articles", {
    domain: "article",
    projectRoot: root,
  });
  expect(target.startsWith(state + path.sep)).toBe(true);
  expect(withWorkspaceState(root, defaultStateDir)).toBe(root);
});
