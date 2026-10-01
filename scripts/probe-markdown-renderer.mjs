import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const projectRoot = await realpath(path.resolve(process.argv[2] ?? "../Mizuki"));
const projectRequire = createRequire(path.join(projectRoot, "package.json"));

async function projectPackage(name) {
  let entry;
  try {
    entry = projectRequire.resolve(name);
  } catch (error) {
    if (error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
    const directory = path.join(projectRoot, "node_modules", name);
    const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
    const exported = manifest.exports?.["."] ?? manifest.exports;
    const imported = typeof exported === "string" ? exported : exported?.import;
    assert.equal(typeof imported, "string", `${name}: no import entry`);
    entry = path.join(directory, imported);
  }
  return import(pathToFileURL(entry).href);
}

async function projectFile(relative) {
  return import(pathToFileURL(path.join(projectRoot, relative)).href);
}

function timed(result, start) {
  return { ...result, milliseconds: Math.round((performance.now() - start) * 10) / 10 };
}

const startup = performance.now();
const [markdown, math, directive, sectionize, katex, slug, autolink, codeGroup, components] =
  await Promise.all([
    projectPackage("@astrojs/markdown-remark"),
    projectPackage("remark-math"),
    projectPackage("remark-directive"),
    projectPackage("remark-sectionize"),
    projectPackage("rehype-katex"),
    projectPackage("rehype-slug"),
    projectPackage("rehype-autolink-headings"),
    projectPackage("rehype-code-group"),
    projectPackage("rehype-components"),
  ]);

const [markdownConfig, permalinkConfig, siteConfig, expressiveCodeConfig] = await Promise.all([
  projectFile("src/config/markdownConfig.ts"),
  projectFile("src/config/permalinkConfig.ts"),
  projectFile("src/config/siteConfig.ts"),
  projectFile("src/config/expressiveCodeConfig.ts"),
]);

const [
  remarkContent,
  remarkFixGithubAdmonitions,
  remarkEscapeNumericColons,
  remarkWikiLink,
  remarkAutoImageGrid,
  parseDirectiveNode,
  remarkMermaid,
  remarkPlantuml,
  remarkMarkSectionized,
  rehypeContentLinks,
  rehypeWrapTable,
  rehypeMermaid,
  rehypePlantuml,
  admonition,
  githubCard,
  imageGrid,
  rehypeMarkdownImages,
] = await Promise.all([
  projectFile("src/plugins/remark-content.mjs"),
  projectFile("src/plugins/remark-fix-github-admonitions.js"),
  projectFile("src/plugins/remark-escape-numeric-colons.mjs"),
  projectFile("src/plugins/remark-wiki-link.mjs"),
  projectFile("src/plugins/remark-auto-image-grid.mjs"),
  projectFile("src/plugins/remark-directive-rehype.js"),
  projectFile("src/plugins/remark-mermaid.js"),
  projectFile("src/plugins/remark-plantuml.mjs"),
  projectFile("src/plugins/remark-mark-sectionized.mjs"),
  projectFile("src/plugins/rehype-content-links.mjs"),
  projectFile("src/plugins/rehype-wrap-table.mjs"),
  projectFile("src/plugins/rehype-mermaid.mjs"),
  projectFile("src/plugins/rehype-plantuml.mjs"),
  projectFile("src/plugins/rehype-component-admonition.mjs"),
  projectFile("src/plugins/rehype-component-github-card.mjs"),
  projectFile("src/plugins/rehype-component-image-grid.mjs"),
  projectFile("src/plugins/rehype-markdown-images.mjs"),
]);

const { markdownConfig: enhancements } = markdownConfig;
const { siteConfig: site } = siteConfig;
const { expressiveCodeConfig: codeConfig } = expressiveCodeConfig;

const remarkPlugins = [
  math.default,
  remarkContent.remarkContent,
  remarkFixGithubAdmonitions.remarkFixGithubAdmonitions,
  directive.default,
  remarkEscapeNumericColons.remarkEscapeNumericColons,
  ...(enhancements.wikiLink.enable
    ? [
        [
          remarkWikiLink.remarkWikiLink,
          {
            ...enhancements.wikiLink,
            permalink: permalinkConfig.permalinkConfig,
            imageApi: site.banner.imageApi,
            noReferrerDomains: site.imageOptimization?.noReferrerDomains ?? [],
          },
        ],
      ]
    : []),
  ...(enhancements.autoImageGrid.enable
    ? [[remarkAutoImageGrid.remarkAutoImageGrid, enhancements.autoImageGrid]]
    : []),
  parseDirectiveNode.parseDirectiveNode,
  remarkMermaid.remarkMermaid,
  [remarkPlantuml.remarkPlantuml, enhancements.plantuml],
  sectionize.default,
  remarkMarkSectionized.remarkMarkSectionized,
];

const rehypePlugins = [
  katex.default,
  [
    rehypeContentLinks.rehypeContentLinks,
    {
      siteUrl: site.siteURL,
      target: "_blank",
      rel: ["nofollow", "noopener", "noreferrer"],
    },
  ],
  slug.default,
  ...(codeConfig.codeGroup.enable ? [codeGroup.default] : []),
  rehypeWrapTable.rehypeWrapTable,
  rehypeMermaid.rehypeMermaid,
  rehypePlantuml.rehypePlantuml,
  [
    components.default,
    {
      components: {
        github: githubCard.GithubCardComponent,
        grid: imageGrid.ImageGridComponent,
        ...Object.fromEntries(
          Object.entries({
            note: "note",
            tip: "tip",
            important: "important",
            caution: "caution",
            warning: "warning",
            info: "note",
            abstract: "note",
            summary: "note",
            tldr: "note",
            todo: "note",
            hint: "tip",
            success: "tip",
            check: "tip",
            done: "tip",
            question: "important",
            help: "important",
            faq: "important",
            attention: "warning",
            failure: "caution",
            fail: "caution",
            missing: "caution",
            danger: "caution",
            error: "caution",
            bug: "caution",
            example: "note",
            quote: "note",
            cite: "note",
          }).map(([name, kind]) => [
            name,
            (properties, children) => admonition.AdmonitionComponent(properties, children, kind),
          ]),
        ),
      },
    },
  ],
  [
    autolink.default,
    {
      behavior: "append",
      properties: { className: ["anchor"] },
      content: {
        type: "element",
        tagName: "span",
        properties: { className: ["anchor-icon"], "data-pagefind-ignore": true },
        children: [{ type: "text", value: "#" }],
      },
    },
  ],
  [
    rehypeMarkdownImages.rehypeMarkdownImages,
    {
      noReferrerDomains: site.imageOptimization?.noReferrerDomains ?? [],
    },
  ],
];

const processorStart = performance.now();
const processor = await markdown.createMarkdownProcessor({
  remarkPlugins,
  rehypePlugins,
  syntaxHighlight: false,
});
const setup = {
  importMilliseconds: Math.round((processorStart - startup) * 10) / 10,
  processorMilliseconds: Math.round((performance.now() - processorStart) * 10) / 10,
};

async function renderSample(label, source, filename, expected) {
  const begin = performance.now();
  const { code } = await processor.render(source, {
    fileURL: pathToFileURL(filename).href,
    frontmatter: {},
  });
  for (const marker of expected) {
    assert.ok(code.includes(marker), `${label}: missing ${marker}`);
  }
  return timed(
    { label, bytes: Buffer.byteLength(source), htmlBytes: Buffer.byteLength(code) },
    begin,
  );
}

const fixture = [
  "# 标题",
  "",
  "| 列 A | 列 B |",
  "| --- | --- |",
  "| 一 | 二 |",
  "",
  ":::warning[提示]",
  "请检查 **设置**。",
  ":::",
  "",
  "[[Qt框架功能概述]]",
  "",
  "行内公式 $E=mc^2$。",
  "",
  "```mermaid",
  "graph TD; A-->B;",
  "```",
  "",
  "```plantuml",
  "@startuml",
  "Alice -> Bob: hello",
  "@enduml",
  "```",
  "",
  "![示意图](/images/demo.png)",
].join("\n");

const samples = [];
samples.push(
  await renderSample(
    "Mizuki 扩展草稿",
    fixture,
    path.join(projectRoot, "src/content/posts/panel-probe.md"),
    ["<h1", "<table", "admonition", "card-wiki-link", "katex", "mermaid", "plantuml", "<img"],
  ),
);

for (const name of ["Qt框架功能概述.md", "vs2022配置protobuf.md"]) {
  const filename = path.join(projectRoot, "src/content/posts", name);
  const source = await readFile(filename, "utf8");
  const body = source.replace(/^\uFEFF?---[ \t]*\r?\n[\s\S]*?^---[ \t]*(?:\r?\n|$)/m, "");
  assert.notEqual(body, source, `${name}: expected Frontmatter`);
  samples.push(await renderSample(name, body, filename, ["<p", "<h"]));
}

const changedDraft = fixture.replace("请检查 **设置**。", "请检查 **修改后的设置**。");
samples.push(
  await renderSample(
    "未保存草稿更新",
    changedDraft,
    path.join(projectRoot, "src/content/posts/panel-probe.md"),
    ["修改后的设置"],
  ),
);

console.log(
  JSON.stringify(
    {
      projectRoot,
      processor: "@astrojs/markdown-remark createMarkdownProcessor",
      plugins: { remark: remarkPlugins.length, rehype: rehypePlugins.length },
      setup,
      samples,
    },
    null,
    2,
  ),
);
