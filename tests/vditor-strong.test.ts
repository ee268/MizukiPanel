import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { expect, it } from "vitest";
import { configureVditorStrong } from "../src/client/articles/vditor-strong";

type LuteInstance = Record<string, (...args: string[]) => string>;
const require = createRequire(import.meta.url);
const context = createContext({ TextDecoder, TextEncoder, setTimeout, clearTimeout });
runInContext(readFileSync(require.resolve("vditor/dist/js/lute/lute.min.js"), "utf8"), context);
const factory = context.Lute as { New: () => LuteInstance };
const nativeCreate = factory.New;
configureVditorStrong(factory);

const body =
  "QObject的**inherits()**函数，函数**tr()**用于返回。**parent()**函数返回父对象，**children()**函数返回子对象。QObject的**setProperty()**函数和**property()**函数。";
const names = ["inherits()", "tr()", "parent()", "children()", "setProperty()", "property()"];

it("renders punctuation-ending bold beside Chinese in every mode and preserves Markdown", () => {
  const lute = factory.New();
  for (const mode of ["", "IR", "SV"]) {
    const html = lute[`Md2Vditor${mode}DOM`](body);
    for (const name of names) {
      expect(html).toContain(mode === "SV" ? `class="strong">${name}</span>` : `>${name}</strong>`);
    }
    if (mode !== "SV") expect(lute[`Vditor${mode}DOM2Md`](html)).toBe(body + "\n");
    const spun = lute[`SpinVditor${mode}DOM`](html);
    for (const name of names)
      expect(spun).toContain(mode === "SV" ? `class="strong">${name}</span>` : `>${name}</strong>`);
    expect(spun).not.toMatch(/[\uE000-\uF8FF]/u);
  }
  for (const name of names) expect(lute.Md2HTML(body)).toContain(`<strong>${name}</strong>`);
  expect(lute.MarkdownStr("test", body)).toContain("<strong>inherits()</strong>");
});

it("keeps code, escaped stars, inline HTML, images and original private-use characters", () => {
  const lute = factory.New();
  const source =
    "`**tr()**函数`，\\*\\*parent()\\*\\*函数。\n\n```txt\n**children()**函数\n```\n\n<span>**property()**函数</span> ![**tr()**函数](./**tr()**函数.png) \uE000 \uE001\n";
  const html = lute.Md2HTML(source);
  expect(html).toContain("<code>**tr()**函数</code>");
  expect(html).toContain("**parent()**函数");
  expect(html).toContain("**children()**函数");
  expect(html).toContain("<span><strong>property()</strong>函数</span>");
  expect(html).toContain('src="./**tr()**%E5%87%BD%E6%95%B0.png"');
  expect(html).toContain("\uE000 \uE001");
  const ir = lute.Md2VditorIRDOM(source);
  const value = lute.VditorIRDOM2Md(lute.SpinVditorIRDOM(ir));
  expect(value).toContain("`**tr()**函数`");
  expect(value).toContain("**children()**函数\n```");
  expect(decodeURIComponent(value)).toContain("./**tr()**函数.png");
  expect(value).not.toMatch(/[\uE002-\uF8FF]/u);
});

it("preserves destinations in reference links, autolinks and HTML attributes", () => {
  const lute = factory.New();
  const source =
    '[引用][id]\n\n[id]: ./**tr()**函数.png\n\n<https://example.com/**tr()**函数>\n\n<img src="./**tr()**函数.png">\n';
  const html = lute.Md2HTML(source);
  expect(html).toBe(nativeCreate().Md2HTML(source));
  expect(decodeURIComponent(html)).toContain('href="https://example.com/**tr()**函数"');
  expect(html).toContain('<img src="./**tr()**函数.png">');
  expect(html).not.toMatch(/[\uE000-\uF8FF]/u);
});

it("treats damaged markers as text and recognizes them again after repair", () => {
  const lute = factory.New();
  expect(lute.Md2HTML("QObject的**inherits()*函数")).not.toContain("<strong>");
  expect(lute.Md2HTML("QObject的**inherits()**函数")).toContain("<strong>inherits()</strong>");
  const ir = lute
    .Md2VditorIRDOM("QObject的**inherits()**函数")
    .replace("inherits()", "inherits(<wbr>)");
  expect(lute.SpinVditorIRDOM(ir)).toContain("inherits(<wbr>)</strong>");
});

it("configures multiple independent engines only once", () => {
  const create = factory.New;
  configureVditorStrong(factory);
  expect(factory.New).toBe(create);
  expect(factory.New().Md2HTML(body)).toBe(factory.New().Md2HTML(body));
});

it("keeps escaped openings and code literal while accepting an unescaped opening", () => {
  const lute = factory.New();
  for (const source of [
    String.raw`\**tr()**函数`,
    String.raw`\*\*tr()**函数`,
    "`**tr()**函数`",
    "``**tr()**函数``",
  ]) {
    expect(lute.Md2HTML(source)).toBe(nativeCreate().Md2HTML(source));
  }
  expect(lute.Md2HTML(String.raw`\\**tr()**函数`)).toContain("<strong>tr()</strong>");
});
