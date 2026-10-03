import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { rehypePreviewResources } from "./markdown-preview-resources";

type DynamicModule = Record<string, any>;

export interface PreviewProcessor {
  render: (
    body: string,
    options: { fileURL: string; frontmatter: Record<string, unknown> },
  ) => Promise<{ code: string }>;
  hue: number;
  differences: string[];
}

async function projectPackage(root: string, name: string): Promise<DynamicModule> {
  const projectRequire = createRequire(path.join(root, "package.json"));
  let entry: string;
  try {
    entry = projectRequire.resolve(name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
    const directory = path.join(root, "node_modules", name);
    const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
    const exported = manifest.exports?.["."] ?? manifest.exports;
    const imported = typeof exported === "string" ? exported : exported?.import;
    if (typeof imported !== "string") throw new Error(`${name} 缺少可导入入口`);
    entry = path.join(directory, imported);
  }
  return import(/* @vite-ignore */ pathToFileURL(entry).href);
}

async function projectFile(
  root: string,
  relative: string,
  fingerprint: string,
): Promise<DynamicModule> {
  const url = pathToFileURL(path.join(root, relative));
  url.searchParams.set("panelPreview", fingerprint);
  return import(/* @vite-ignore */ url.href);
}

const admonitionKinds: Record<string, string> = {
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
};

/** Load the same plugin order used by Mizuki's astro.config.mjs, without Astro startup. */
export async function createMizukiMarkdownProcessor(
  root: string,
  articleId: string,
  fingerprint: string,
  externalContent: boolean,
): Promise<PreviewProcessor> {
  const packages = await Promise.all(
    [
      "@astrojs/markdown-remark",
      "remark-math",
      "remark-directive",
      "remark-sectionize",
      "rehype-katex",
      "rehype-slug",
      "rehype-autolink-headings",
      "rehype-code-group",
      "rehype-components",
    ].map((name) => projectPackage(root, name)),
  );
  const [markdown, math, directive, sectionize, katex, slug, autolink, codeGroup, components] =
    packages;

  const files = await Promise.all(
    [
      "src/config/markdownConfig.ts",
      "src/config/permalinkConfig.ts",
      "src/config/siteConfig.ts",
      "src/config/expressiveCodeConfig.ts",
      "src/plugins/remark-content.mjs",
      "src/plugins/remark-fix-github-admonitions.js",
      "src/plugins/remark-escape-numeric-colons.mjs",
      "src/plugins/remark-wiki-link.mjs",
      "src/plugins/remark-auto-image-grid.mjs",
      "src/plugins/remark-directive-rehype.js",
      "src/plugins/remark-mermaid.js",
      "src/plugins/remark-plantuml.mjs",
      "src/plugins/remark-mark-sectionized.mjs",
      "src/plugins/rehype-content-links.mjs",
      "src/plugins/rehype-wrap-table.mjs",
      "src/plugins/rehype-mermaid.mjs",
      "src/plugins/rehype-plantuml.mjs",
      "src/plugins/rehype-component-admonition.mjs",
      "src/plugins/rehype-component-github-card.mjs",
      "src/plugins/rehype-component-image-grid.mjs",
      "src/plugins/rehype-markdown-images.mjs",
    ].map((relative) => projectFile(root, relative, fingerprint)),
  );
  const [
    markdownConfig,
    permalinkConfig,
    siteConfig,
    expressiveCodeConfig,
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
  ] = files;
  const enhancements = markdownConfig.markdownConfig;
  const site = siteConfig.siteConfig;
  const codeConfig = expressiveCodeConfig.expressiveCodeConfig;
  const differences = [
    "代码围栏与代码组尚未使用 Mizuki 的 Expressive Code 高亮与交互脚本。",
    "Mermaid 输出容器但不运行站点脚本，图形暂不绘制。",
    "正文使用 Mizuki 的扩展 Stylus，但尚未装载完整 Tailwind 样式与交互脚本。",
    "PlantUML 依赖配置的远程图像服务，离线时可能无法显示。",
  ];
  if (externalContent && enhancements.wikiLink.enable) {
    differences.push("独立内容仓库的 Wiki Link 元数据暂不索引，链接显示可能不同于发布站点。");
  }

  const remarkPlugins = [
    math.default,
    remarkContent.remarkContent,
    remarkFixGithubAdmonitions.remarkFixGithubAdmonitions,
    directive.default,
    remarkEscapeNumericColons.remarkEscapeNumericColons,
    ...(!externalContent && enhancements.wikiLink.enable
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
            Object.entries(admonitionKinds).map(([name, kind]) => [
              name,
              (properties: unknown, children: unknown) =>
                admonition.AdmonitionComponent(properties, children, kind),
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
    [rehypePreviewResources, { articleId }],
  ];

  const processor = await markdown.createMarkdownProcessor({
    remarkPlugins,
    rehypePlugins,
    syntaxHighlight: false,
  });
  return {
    render: processor.render.bind(processor),
    hue: Number.isFinite(site.themeColor?.hue) ? site.themeColor.hue : 240,
    differences,
  };
}
