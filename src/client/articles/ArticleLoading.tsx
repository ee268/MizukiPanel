import { ContentLoading } from "../components/ContentLoading";

export function ArticleLoading({ title }: { title?: string }) {
  return (
    <ContentLoading
      heading="正在展开文章"
      description={`${title ? `《${title}》` : "文章"} · 正在准备内容与编辑区域`}
    />
  );
}
