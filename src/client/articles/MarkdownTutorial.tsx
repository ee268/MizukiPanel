import { useState } from "react";
import type { ArticleRecord } from "../types";
import { ArticleEditor } from "./ArticleEditor";
import type { ArticleEditorMode } from "./types";
import tutorialSource from "./markdown-tutorial.mdx?raw";

interface MarkdownTutorialProps {
  projectRoot: string;
  onLoadEnd?: () => void;
}

const tutorialArticle: ArticleRecord = {
  id: "__mizuki_panel_markdown_tutorial__.mdx",
  title: "Markdown 教程",
  description: "从基础 Markdown 到 Mizuki 扩展与 MDX 组件",
  image: "",
  published: "",
  draft: true,
  format: "mdx",
  error: null,
  alias: "",
  permalink: "",
  slug: "",
  tags: [],
  category: "",
  source: tutorialSource,
  version: "built-in",
  frontmatter: [{ key: "title", value: "Markdown 教程" }],
};

export function MarkdownTutorial({ projectRoot, onLoadEnd }: MarkdownTutorialProps) {
  const [source, setSource] = useState(tutorialSource);
  const [mode, setMode] = useState<ArticleEditorMode>("visual");

  return (
    <ArticleEditor
      temporary
      article={tutorialArticle}
      projectRoot={projectRoot}
      previewPath={null}
      frontmatter={[]}
      source={source}
      mode={mode}
      busy={false}
      readOnly={false}
      dirty={false}
      sourceDirty={false}
      onFrontmatterChange={() => {}}
      onSourceChange={setSource}
      onModeChange={setMode}
      onPreview={() => {}}
      onRename={() => {}}
      onDelete={() => {}}
      onSaveFrontmatter={() => {}}
      onSaveDocument={() => {}}
      onSaveBody={() => {}}
      onLoadEnd={onLoadEnd}
    />
  );
}
