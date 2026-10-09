import { mkdir, mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { isMap } from "yaml";
import {
  expandTemplate,
  templateDefaults,
  validTemplateField,
} from "../src/shared/panel-settings/article-template";
import {
  articleProjectKey,
  prepareArticleCreation,
  readArticleTemplate,
} from "../src/lib/server/article-template";
import {
  readPanelSettings,
  savePanelSettings,
  settingsProjectKey,
} from "../src/lib/server/panel-settings";
import { createArticleFromSource, readArticle } from "../src/lib/server/articles";
import { newArticleSource, parseArticleSource } from "../src/lib/server/article-format";
import type { ProjectReport } from "../src/lib/server/project";
const dirs: string[] = [];
async function fixture(external = false) {
  const base = await mkdtemp(path.join(tmpdir(), "mizuki-template-"));
  dirs.push(base);
  const root = path.join(base, "site");
  const contentRoot = external ? path.join(base, "content") : null;
  await mkdir(root);
  await mkdir(path.join(contentRoot ?? root, external ? "posts" : "src/content/posts"), {
    recursive: true,
  });
  const report: ProjectReport = {
    root,
    requestedPath: root,
    contentRoot,
    mode: external ? "external" : "local",
    readOnly: false,
    mappings: [],
    warnings: [],
  };
  return { report, stateDir: path.join(base, "state") };
}
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
it("generates readable block YAML while preserving special text, nested defaults and scalar types", () => {
  const fields = { title: "示例文章", published: "2026-10-09", draft: true };
  expect(newArticleSource(fields, "# 开始写作")).toBe(
    "---\ntitle: 示例文章\npublished: 2026-10-09\ndraft: true\n---\n\n# 开始写作",
  );
  const title = '标题: "引号"\n第二行';
  const defaults = { tags: ["one", "two"], custom: { enabled: false, count: 3 } };
  const source = newArticleSource({ ...fields, title }, "# Body", defaults);
  const parsed = parseArticleSource(source);
  expect(parsed.document.contents?.toJSON()).toEqual({ ...defaults, ...fields, title });
  expect(isMap(parsed.document.contents) && !parsed.document.contents.flow).toBe(true);
  expect(parsed.parts.body).toBe("\n# Body");
});
it("only expands supported variables and safely interpolates YAML values rather than YAML syntax", () => {
  const title = "x: value\nadmin: true {{literal}}";
  expect(templateDefaults('custom: "{{title}}"\ntags: [one, two]', { title })).toEqual({
    custom: title,
    tags: ["one", "two"],
  });
  expect(() => expandTemplate("{{process.exit()}}", {})).toThrow("不支持");
  expect(() => expandTemplate("{{title", {})).toThrow("完整");
  expect(validTemplateField("fileName", "../{{slug}}.md")).toBe(false);
  expect(validTemplateField("fileName", "notes/{{date}}-{{slug}}.mdx")).toBe(true);
  expect(validTemplateField("frontmatter", "tags: [broken")).toBe(false);
  expect(validTemplateField("frontmatter", "- list")).toBe(false);
});
it("reads defaults without writing and previews/creates the same content in local and external repositories", async () => {
  for (const external of [false, true]) {
    const { report, stateDir } = await fixture(external);
    const initial = await readArticleTemplate(report, stateDir);
    expect(initial.values.body).toBe("# 开始写作");
    expect(initial.settingsVersion).toBeNull();
    const key = await settingsProjectKey(report.root);
    const saved = await savePanelSettings(
      {
        scope: "project",
        group: "articleTemplate",
        projectKey: key,
        version: null,
        fields: {
          body: "# {{title}}\n\nCreated {{date}}",
          frontmatter: 'tags: [custom]\ncustom: "{{title}}"',
          fileName: "{{year}}/{{date}}-{{slug}}.mdx",
        },
      },
      stateDir,
    );
    const fields = {
      id: "",
      title: 'Hello: "World"',
      published: "2026-10-09",
      draft: true,
      body: initial.values.body,
      frontmatter: 'custom: "{{title}}"',
      projectKey: initial.projectKey,
      settingsVersion: saved.version,
    };
    const preview = await prepareArticleCreation(report, fields, stateDir);
    expect(preview.id).toMatch(/^2026\/2026-10-09-/);
    expect(preview.source).toMatch(/^---\ncustom:/);
    expect(parseArticleSource(preview.source).data.custom).toBe(fields.title);
    expect(
      (
        await readdir(
          path.join(report.contentRoot ?? report.root, external ? "posts" : "src/content/posts"),
        )
      ).length,
    ).toBe(0);
    await createArticleFromSource(report, preview.id, preview.source);
    expect((await readArticle(report, preview.id)).source).toBe(preview.source);
    await expect(prepareArticleCreation(report, fields, stateDir)).rejects.toThrow("同名");
    expect((await readPanelSettings("project", key, stateDir)).version).toBe(saved.version);
  }
});
it("rejects old projects/settings, invalid metadata and path/URL collisions without creating files", async () => {
  const { report, stateDir } = await fixture();
  const initial = await readArticleTemplate(report, stateDir);
  const fields = {
    id: "one.md",
    title: "One",
    published: "2026-10-09",
    draft: true,
    body: "Body",
    frontmatter: "",
    projectKey: initial.projectKey,
    settingsVersion: null,
  };
  await expect(
    prepareArticleCreation(report, { ...fields, projectKey: "other" }, stateDir),
  ).rejects.toThrow("项目");
  await expect(
    prepareArticleCreation(report, { ...fields, published: "2026-02-30" }, stateDir),
  ).rejects.toThrow();
  await expect(
    prepareArticleCreation(report, { ...fields, id: "../one.md" }, stateDir),
  ).rejects.toThrow("不安全");
  const first = await prepareArticleCreation(
    report,
    { ...fields, frontmatter: "alias: shared" },
    stateDir,
  );
  await createArticleFromSource(report, first.id, first.source);
  await expect(
    prepareArticleCreation(
      report,
      { ...fields, id: "two.md", frontmatter: "alias: shared" },
      stateDir,
    ),
  ).rejects.toThrow("冲突");
  const key = await settingsProjectKey(report.root);
  await expect(
    savePanelSettings(
      {
        scope: "project",
        group: "articleTemplate",
        projectKey: key,
        version: null,
        fields: { frontmatter: "image: javascript:alert(1)" },
      },
      stateDir,
    ),
  ).rejects.toThrow();
  await savePanelSettings(
    {
      scope: "project",
      group: "articleTemplate",
      projectKey: key,
      version: null,
      fields: { fileName: "{{slug}}.md" },
    },
    stateDir,
  );
  await expect(
    prepareArticleCreation(report, { ...fields, id: "fresh.md" }, stateDir),
  ).rejects.toThrow("默认值已变化");
  expect((await readdir(path.join(report.root, "src/content/posts"))).length).toBe(1);
});
it("isolates actual content repositories and refuses read-only creation and concurrent colliding routes", async () => {
  const { report, stateDir } = await fixture(true);
  const local = { ...report, mode: "local" as const, contentRoot: null };
  expect(await articleProjectKey(report)).not.toBe(await articleProjectKey(local));
  const defaults = await readArticleTemplate(report, stateDir);
  const fields = {
    title: "One",
    published: "2026-10-09",
    draft: true,
    body: "Body",
    frontmatter: "alias: shared",
    projectKey: defaults.projectKey,
    settingsVersion: null,
  };
  const first = await prepareArticleCreation(report, { ...fields, id: "a.md" }, stateDir);
  const second = await prepareArticleCreation(report, { ...fields, id: "b.md" }, stateDir);
  await expect(
    prepareArticleCreation({ ...report, readOnly: true }, { ...fields, id: "c.md" }, stateDir),
  ).rejects.toThrow("只读");
  await expect(
    createArticleFromSource({ ...report, readOnly: true }, first.id, first.source),
  ).rejects.toThrow("只读");
  const result = await Promise.allSettled([
    createArticleFromSource(report, first.id, first.source),
    createArticleFromSource(report, second.id, second.source),
  ]);
  expect(result.filter((value) => value.status === "fulfilled")).toHaveLength(1);
  expect((await readdir(path.join(report.contentRoot!, "posts"))).length).toBe(1);
});
