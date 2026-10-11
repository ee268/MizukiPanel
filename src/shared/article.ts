export interface ArticleListItem {
  id: string;
  title: string;
  description: string;
  image: string;
  published: string;
  draft: boolean;
  format: "md" | "mdx";
  error: string | null;
  alias: string;
  permalink: string;
  slug: string;
  tags: string[];
  category: string;
}

export interface FrontmatterEntry {
  key: string;
  value: string;
  originalKey?: string;
}
