import {
  segmentArticleSource,
  type ArticleFormat,
  type SegmentedArticle,
} from "../../lib/articles/source-islands";

interface SegmentRequest {
  source: string;
  format: ArticleFormat;
}

export type SegmentResult =
  { snapshot: SegmentedArticle; error?: never } | { error: string; snapshot?: never };

self.onmessage = (event: MessageEvent<SegmentRequest>) => {
  try {
    self.postMessage({ snapshot: segmentArticleSource(event.data.source, event.data.format) });
  } catch (cause) {
    self.postMessage({ error: cause instanceof Error ? cause.message : "正文解析失败" });
  }
};
