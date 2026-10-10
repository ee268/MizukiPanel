import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import type { ProjectReport } from "../src/lib/server/project";
import {
  deleteAlbum,
  deleteAnimeSeason,
  listAlbums,
  listAnimeSeasons,
  readFeatureData,
  readFeatureText,
  restoreFeatureFile,
  saveAlbum,
  saveAnimeSeason,
  saveFeatureData,
  saveFeatureText,
  featureIndex,
} from "../src/lib/server/features";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((entry) => rm(entry, { recursive: true, force: true })),
  );
});

async function fixture(mode: "local" | "external") {
  const root = await mkdtemp(path.join(tmpdir(), "mizuki-features-"));
  const contentRoot = path.join(root, "content");
  temporary.push(root);
  const base = mode === "local" ? root : contentRoot;
  const dataDir = mode === "local" ? path.join(base, "src/data") : path.join(base, "data");
  const specDir = mode === "local" ? path.join(base, "src/content/spec") : path.join(base, "spec");
  const animeDir =
    mode === "local" ? path.join(base, "src/content/animes") : path.join(base, "animes");
  const albumDir =
    mode === "local" ? path.join(base, "public/images/albums") : path.join(base, "images/albums");
  await Promise.all(
    [dataDir, specDir, animeDir, albumDir].map((directory) =>
      mkdir(directory, { recursive: true }),
    ),
  );
  await mkdir(path.join(root, "src/config"), { recursive: true });
  await writeFile(
    path.join(root, "src/config/siteConfig.ts"),
    'export const siteConfig = { featurePages: { friends: true, diary: true, anime: true, albums: false, projects: true, skills: true, devices: true, timeline: true, aiTools: true }, diaryApiUrl: "https://memos.example.com", anime: { mode: "bangumi" } };\n',
  );
  await writeFile(
    path.join(root, "src/config/navBarConfig.ts"),
    'export const navBarConfig = { links: [{ url: "/friends/" }, { url: "/anime/" }] };\n',
  );
  await writeFile(
    path.join(dataDir, "friends.ts"),
    'export const friendsData = [{ id: 1, title: "One", siteurl: "https://example.com", tags: [] }];\nexport const count = () => friendsData.length;\n',
  );
  const report: ProjectReport = {
    requestedPath: root,
    root,
    mode,
    readOnly: false,
    contentRoot: mode === "external" ? contentRoot : null,
    warnings: [],
    mappings: [],
  };
  return { root, contentRoot, report, dataDir };
}

it("reports page switches, navigation gaps and remote data source modes", async () => {
  const { report } = await fixture("external");
  const index = await featureIndex(report);
  expect(index.modules).toHaveLength(10);
  expect(index.modules.find((item) => item.key === "albums")).toMatchObject({
    enabled: false,
    navigationConfigured: false,
  });
  expect(index.modules.find((item) => item.key === "friends")).toMatchObject({
    enabled: true,
    navigationConfigured: true,
    resources: ["friends"],
  });
  expect(index.modules.find((item) => item.key === "diary")).toMatchObject({ sourceMode: "memos" });
  expect(index.modules.find((item) => item.key === "anime")).toMatchObject({
    sourceMode: "bangumi",
    resources: ["animeSeasons"],
  });
});

it.each(["local", "external"] as const)(
  "selects the anime editor from the active %s content directory",
  async (mode) => {
    const { root, contentRoot, report } = await fixture(mode);
    const animeDir =
      mode === "local" ? path.join(root, "src/content/animes") : path.join(contentRoot, "animes");
    const animeResources = async () =>
      (await featureIndex(report)).modules.find((item) => item.key === "anime")!.resources;

    // An installed custom feature remains editable with no season records yet.
    expect(await animeResources()).toEqual(["animeSeasons"]);
    const season = await saveAnimeSeason(report, "2027/1月.md", "---\ntitle: Season\n---\n", "");
    expect(await animeResources()).toEqual(["animeSeasons"]);
    await deleteAnimeSeason(report, season.document.id, season.document.version);
    expect(await animeResources()).toEqual(["animeSeasons"]);

    await rm(animeDir, { recursive: true });
    if (mode === "external") {
      // A stale local copy must not override the external content source.
      await mkdir(path.join(root, "src/content/animes"), { recursive: true });
    }
    expect(await animeResources()).toEqual(["anime"]);
    await writeFile(animeDir, "Not a directory");
    expect(await animeResources()).toEqual(["anime"]);
  },
);

it("edits and restores feature data without changing helper code in both content modes", async () => {
  for (const mode of ["local", "external"] as const) {
    const { report, dataDir } = await fixture(mode);
    const current = await readFeatureData(report, "friends");
    expect(current.value).toHaveLength(1);
    const value = [
      { id: 1, title: "Updated", siteurl: "https://example.com", tags: ["docs"] },
      { id: 2, title: "Two", siteurl: "/about/", tags: [] },
    ];
    const saved = await saveFeatureData(report, "friends", value, current.version);
    expect(saved.document.value).toEqual(value);
    expect(await readFile(path.join(dataDir, "friends.ts"), "utf8")).toContain(
      "export const count = () => friendsData.length",
    );
    const restored = await restoreFeatureFile(
      report,
      "data",
      "friends",
      saved.backupPath!,
      saved.document.version,
    );
    expect(restored).toMatchObject({
      value: [{ id: 1, title: "One", siteurl: "https://example.com", tags: [] }],
    });
  }
});

it("creates feature markdown and manages anime seasons with recoverable deletion", async () => {
  const { report, contentRoot } = await fixture("external");
  const text = await readFeatureText(report, "aboutText");
  expect(text.exists).toBe(false);
  const savedText = await saveFeatureText(report, "aboutText", "# About\n", text.version);
  expect(savedText.document.content).toBe("# About\n");
  const seasonSource = "---\ntitle: 2027年1月新番\n---\n\n{% 123 %}\n";
  const saved = await saveAnimeSeason(report, "2027/1月.md", seasonSource, "");
  expect((await listAnimeSeasons(report)).seasons.map((item) => item.id)).toContain("2027/1月.md");
  const trash = await deleteAnimeSeason(report, "2027/1月.md", saved.document.version);
  await expect(access(path.join(contentRoot, "animes/2027/1月.md"))).rejects.toThrow();
  expect(await readFile(trash, "utf8")).toContain("{% 123 %}");
});

it("creates, lists, updates and safely deletes album metadata directories", async () => {
  const { report, contentRoot } = await fixture("external");
  const created = await saveAlbum(
    report,
    "travel-2027",
    {
      mode: "external",
      title: "Travel",
      date: "2027-01-02",
      cover: "https://example.com/cover.webp",
      photos: [{ id: "one", src: "https://example.com/one.webp", alt: "One" }],
    },
    "",
  );
  const album = created.albums.albums.find((item) => item.id === "travel-2027")!;
  expect(album.complete).toBe(true);
  const updated = await saveAlbum(report, album.id, { ...album.info, hidden: true }, album.version);
  const next = updated.albums.albums.find((item) => item.id === album.id)!;
  const trash = await deleteAlbum(report, album.id, next.version);
  await expect(access(path.join(contentRoot, "images/albums/travel-2027"))).rejects.toThrow();
  expect(await readFile(path.join(trash, "info.json"), "utf8")).toContain('"hidden": true');
  expect((await listAlbums(report)).albums).toHaveLength(0);
});
