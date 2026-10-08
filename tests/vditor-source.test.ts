import { expect, it } from "vitest";
import {
  replaceVditorBody,
  vditorBody,
  vditorImageMarkdown,
  vditorImagePreviewUrl,
} from "../src/client/articles/vditor-source";

it("keeps BOM, Frontmatter comments and CRLF bytes while replacing only the body", () => {
  const source = '\uFEFF---\r\ntitle: "标题" # 保留\r\ntags: [one]\r\n---\r\n正文\r\n';
  expect(vditorBody(source)).toBe("正文\n");
  expect(replaceVditorBody(source, "# 新标题\n\n新正文\n")).toBe(
    source.slice(0, source.indexOf("正文")) + "# 新标题\r\n\r\n新正文\r\n",
  );
});
it("preserves MDX and project-specific syntax in the body adapter", () => {
  const source =
    '---\ntitle: mdx\n---\nimport A from "./A.astro";\n\n<A value={1}>正文</A>\n\n:::note\n提示\n:::\n';
  expect(replaceVditorBody(source, vditorBody(source))).toBe(source);
});
it("escapes image labels and paths without changing relative references", () => {
  expect(vditorImageMarkdown("图[一]\\\n", "./图 (1).png")).toBe(
    "![图\\[一\\]\\\\ ](./图%20%281%29.png)",
  );
  expect(vditorImageMarkdown("图", "/images/a.png")).toBe("![图](/images/a.png)");
});

it("resolves encoded local filenames without putting the encoded filename into the media path", () => {
  expect(vditorImagePreviewUrl("dir/article.md", "./new%20photo%281%29.png")).toBe(
    "/api/media/file?scope=article&path=dir%2Fnew%20photo(1).png",
  );
  expect(vditorImagePreviewUrl("dir/article.md", "/images/%E5%9B%BE%E7%89%87.png")).toBe(
    "/api/media/file?scope=public&path=%E5%9B%BE%E7%89%87.png",
  );
  expect(vditorImagePreviewUrl("dir/article.md", "https://example.com/new%20photo.png")).toBe(
    "https://example.com/new%20photo.png",
  );
  expect(vditorImagePreviewUrl("dir/article.md", "../../outside.png")).toBeNull();
});
