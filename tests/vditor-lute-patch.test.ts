import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { expect, it } from "vitest";
import { patchVditorLute } from "../scripts/vditor-lute-patch";

const require = createRequire(import.meta.url);
const original = readFileSync(require.resolve("vditor/dist/js/lute/lute.min.js"), "utf8");
function load(source: string) {
  const context = createContext({ TextDecoder, TextEncoder, setTimeout, clearTimeout });
  runInContext(source, context);
  const lute = context.Lute.New();
  lute.SetSanitize(true);
  return lute;
}
const native = load(original);
const patched = load(patchVditorLute(original));

it.each([
  '<img src="./photo.png" alt="山峰、森林" title="HTML 图片示例" />',
  "<img src='./photo.png' alt='English image' title='单引号 示例' />",
  '<img src="./photo.png" alt="" title="" />',
  '<img src = "./photo.png" alt = "图片 说明" style="zoom: 67%;" />',
  '<IMG SRC="./photo.png" TITLE="HTML\t图片" />',
  '<img src="./photo.png" alt="a > b" title="a &amp; b" />',
  '<img src="./photo.png" alt="示意 &quot;图&quot; &amp; &lt;标签&gt;" />',
])("previews a standalone image and preserves its attributes: %s", (tag) => {
  for (const mode of ["", "IR"]) {
    const dom = patched[`Md2Vditor${mode}DOM`](tag);
    expect(dom).toContain('data-type="html-block"');
    expect(dom).toMatch(/<img\b/i);
    const spun = patched[`SpinVditor${mode}DOM`](dom);
    expect(spun).toContain('data-type="html-block"');
    expect(patched[`Vditor${mode}DOM2Md`](spun).trim()).toBe(tag);
  }
});

it("drops the image preview when a tag breaks and restores it after repair", () => {
  const tag = '<img src="./photo.png" title="HTML 图片示例" />';
  for (const damaged of [
    tag.slice(0, -1),
    tag.replace('示例"', "示例"),
    tag.replace("<img", "< img"),
  ]) {
    expect(patched.Md2VditorIRDOM(damaged)).not.toContain('class="vditor-ir__preview"');
  }
  expect(patched.Md2VditorIRDOM(tag)).toContain('class="vditor-ir__preview"');
});

it("retains inline HTML, code literals and the original HTML sanitizer", () => {
  const tag = '<img src="./photo.png" title="HTML 图片示例" />';
  for (const source of [
    `正文 ${tag} 后文`,
    `\`${tag}\``,
    `\`\`\`html\n${tag}\n\`\`\``,
    '<img src="./photo.png" alt="image-20260518014121569" style="zoom:50%;" />',
  ]) {
    expect(patched.Md2VditorIRDOM(source)).toBe(native.Md2VditorIRDOM(source));
    expect(patched.Md2HTML(source)).toBe(native.Md2HTML(source));
  }
  const unsafe = '<img src="javascript:alert(1)" onerror="alert(1)" title="HTML 图片示例" />';
  const dom = patched.Md2VditorIRDOM(unsafe);
  const preview = dom.slice(dom.indexOf('<pre class="vditor-ir__preview"'));
  expect(preview).not.toContain("javascript:");
  expect(preview).not.toContain("onerror=");
  expect(patched.VditorIRDOM2Md(dom).trim()).toBe(unsafe);
});

it("fails clearly when an upgrade changes the bundled parser", () => {
  expect(() => patchVditorLute("unrelated JavaScript")).toThrow("review it before upgrading");
  expect(() => patchVditorLute(original + original)).toThrow("review it before upgrading");
});
