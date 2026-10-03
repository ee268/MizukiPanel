import { expect, it } from "vitest";
import { markdownPreviewDocument } from "../src/client/articles/markdown-preview-document";

it("builds an isolated preview document with theme color and no script execution", () => {
  const result = {
    html: "<h1>Draft</h1><script>window.evil=true</script>",
    css: ".custom-md h1 { letter-spacing: .01em; }",
    hue: 190,
    differences: [],
    milliseconds: 12,
  };
  const document = markdownPreviewDocument(result, "dark", "/assets/katex.css");
  expect(document).toContain("script-src 'none'");
  expect(document).toContain("frame-src 'none'");
  expect(document).toContain("hsl(190 75% 70%)");
  expect(document).toContain('href="/assets/katex.css"');
  expect(document).toContain('<article class="custom-md"><h1>Draft</h1>');
  expect(markdownPreviewDocument(result, "light", "/assets/katex.css")).toContain(
    "hsl(190 75% 42%)",
  );
});
