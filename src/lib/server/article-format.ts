import { isMap, isScalar, isSeq, parseDocument, stringify } from "yaml";
import { splitArticleSource } from "../articles/article-source";

export class ArticleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArticleValidationError";
  }
}

export interface ArticleFields {
  title: string;
  published: string;
  updated: string;
  description: string;
  image: string;
  tags: string;
  category: string;
  author: string;
  lang: string;
  alias: string;
  permalink: string;
  slug: string;
  sourceLink: string;
  licenseName: string;
  licenseUrl: string;
  priority: string;
  password: string;
  passwordHint: string;
  draft: boolean;
  pinned: boolean;
  comment: boolean;
  encrypted: boolean;
  hideHomeContent: boolean;
}

export interface FrontmatterEntry {
  key: string;
  value: string;
  originalKey?: string;
}

function parse(source: string) {
  const parts = splitArticleSource(source);
  if (!parts) throw new ArticleValidationError("文章必须以 --- 分隔的 YAML Frontmatter 开头");
  const document = parseDocument(parts.yaml, { uniqueKeys: true, strict: true });
  if (document.errors.length)
    throw new ArticleValidationError("Frontmatter YAML 无效：" + document.errors[0].message);
  if (!isMap(document.contents)) throw new ArticleValidationError("Frontmatter 顶层必须是键值对象");
  const data = document.toJS() as Record<string, unknown>;
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new ArticleValidationError("Frontmatter 顶层必须是键值对象");
  return { parts, document, data };
}

function asText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function validDate(value: unknown, label: string, required: boolean): string {
  const input = asText(value).trim();
  if (!input) {
    if (required) throw new ArticleValidationError(label + "不能为空");
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const date = new Date(input + "T00:00:00.000Z");
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input)
      throw new ArticleValidationError(label + "必须是有效日期");
    return input;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(input) ||
    !Number.isFinite(Date.parse(input))
  )
    throw new ArticleValidationError(label + "必须是 YYYY-MM-DD 或带时区的 ISO 时间");
  return input;
}

function validWebUrl(value: unknown, label: string): void {
  const input = asText(value).trim();
  if (!input) return;
  try {
    const url = new URL(input);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname) throw new Error();
  } catch {
    throw new ArticleValidationError(label + "必须是 http(s) URL");
  }
}

export function validateRoutePath(value: string, label: string): string {
  const cleaned = value.trim().replace(/^\/+|\/+$/g, "");
  if (!cleaned) throw new ArticleValidationError(label + "不能为空");
  if (/[?#\\%:\s\x00-\x1f]/.test(cleaned) || cleaned.includes("://"))
    throw new ArticleValidationError(label + "不能包含查询、转义、空格或反斜杠");
  for (const segment of cleaned.split("/")) {
    if (!segment || segment === "." || segment === ".." || segment.startsWith("."))
      throw new ArticleValidationError(label + "包含无效路径段");
  }
  return cleaned;
}

export function validateMetadata(data: Record<string, unknown>): void {
  if (typeof data.title !== "string" || !data.title.trim())
    throw new ArticleValidationError("标题不能为空");
  validDate(data.published, "发布日期", true);
  validDate(data.updated, "更新日期", false);
  for (const key of [
    "description",
    "image",
    "lang",
    "author",
    "sourceLink",
    "licenseName",
    "licenseUrl",
    "password",
    "passwordHint",
    "alias",
    "permalink",
    "slug",
  ]) {
    if (data[key] !== undefined && typeof data[key] !== "string")
      throw new ArticleValidationError(key + " 必须是字符串");
  }
  if (data.category !== undefined && data.category !== null && typeof data.category !== "string")
    throw new ArticleValidationError("category 必须是字符串或 null");
  if (
    data.tags !== undefined &&
    (!Array.isArray(data.tags) || data.tags.some((tag) => typeof tag !== "string"))
  )
    throw new ArticleValidationError("标签必须是字符串数组");
  for (const key of ["draft", "pinned", "comment", "encrypted", "hideHomeContent"]) {
    if (data[key] !== undefined && typeof data[key] !== "boolean")
      throw new ArticleValidationError(key + " 必须是布尔值");
  }
  if (
    data.priority !== undefined &&
    (typeof data.priority !== "number" || !Number.isFinite(data.priority))
  )
    throw new ArticleValidationError("priority 必须是数字");
  for (const key of ["alias", "permalink", "slug"])
    if (data[key]) validateRoutePath(asText(data[key]), key);
  validWebUrl(data.sourceLink, "来源链接");
  validWebUrl(data.licenseUrl, "许可链接");
  const image = asText(data.image).trim();
  if (image && /^[A-Za-z][A-Za-z\d+.-]*:/.test(image)) validWebUrl(image, "封面图片");
  if (image && /^(?:javascript:|data:)/i.test(image))
    throw new ArticleValidationError("封面图片地址不安全");
}

export function parseArticleSource(source: string) {
  const parsed = parse(source);
  validateMetadata(parsed.data);
  return parsed;
}

export function frontmatterEntries(data: Record<string, unknown>): FrontmatterEntry[] {
  return Object.entries(data).map(([key, value]) => ({
    key,
    value: stringify(value, {
      collectionStyle: key === "tags" ? "flow" : "any",
      flowCollectionPadding: false,
      lineWidth: 0,
    }).trimEnd(),
    originalKey: key,
  }));
}

function dataFromEntries(entries: FrontmatterEntry[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [index, entry] of entries.entries()) {
    const key = entry.key.trim();
    if (!key) throw new ArticleValidationError(`第 ${index + 1} 行的字段名不能为空`);
    if (/[:\n\r\t\x00-\x1f]/.test(key))
      throw new ArticleValidationError(`字段名包含不支持的字符：${key}`);
    if (Object.hasOwn(data, key))
      throw new ArticleValidationError(`Frontmatter 字段名重复：${key}`);
    const valueDocument = parseDocument(entry.value || "''", { uniqueKeys: true, strict: true });
    if (valueDocument.errors.length)
      throw new ArticleValidationError(
        `字段 ${key} 的 YAML 内容无效：${valueDocument.errors[0].message}`,
      );
    data[key] = valueDocument.toJS();
  }
  validateMetadata(data);
  return data;
}

export function patchArticleFrontmatter(source: string, entries: FrontmatterEntry[]): string {
  const { parts, document, data: currentData } = parse(source);
  const data = dataFromEntries(entries);
  if (!isMap(document.contents)) throw new ArticleValidationError("Frontmatter 顶层必须是键值对象");
  const map = document.contents;
  const existing = new Map(Object.keys(currentData).map((key, index) => [key, map.items[index]]));
  const nextItems = entries.map((entry) => {
    const key = entry.key.trim();
    const pair = existing.get(entry.originalKey ?? entry.key);
    if (!pair) {
      const nextPair = document.createPair(
        entry.key.trim(),
        data[key],
      ) as (typeof map.items)[number];
      if (key === "tags" && isSeq(nextPair.value)) {
        nextPair.value.flow = true;
      }
      return nextPair;
    }
    if (isScalar(pair.key)) pair.key.value = key;
    else pair.key = document.createNode(key) as unknown as typeof pair.key;
    const previousValue = pair.value;
    const nextValue = document.createNode(data[key]);
    if (key === "tags" && isSeq(nextValue)) {
      nextValue.flow = true;
    }
    if (previousValue) {
      nextValue.commentBefore = previousValue.commentBefore;
      nextValue.comment = previousValue.comment;
      nextValue.spaceBefore = previousValue.spaceBefore;
    }
    pair.value = nextValue as typeof pair.value;
    return pair;
  });
  map.items.splice(0, map.items.length, ...nextItems);
  const nextYaml = document
    .toString({ flowCollectionPadding: false, lineWidth: 0 })
    .replace(/\n/g, parts.newline);
  const result = parts.opening + nextYaml + parts.closing + parts.body;
  parseArticleSource(result);
  return result;
}

export function articleFields(data: Record<string, unknown>): ArticleFields {
  const text = (key: string) => asText(data[key]);
  return {
    title: text("title"),
    published: text("published"),
    updated: text("updated"),
    description: text("description"),
    image: text("image"),
    tags: Array.isArray(data.tags) ? data.tags.map(String).join(", ") : "",
    category: text("category"),
    author: text("author"),
    lang: text("lang"),
    alias: text("alias"),
    permalink: text("permalink"),
    slug: text("slug"),
    sourceLink: text("sourceLink"),
    licenseName: text("licenseName"),
    licenseUrl: text("licenseUrl"),
    priority: text("priority"),
    password: text("password"),
    passwordHint: text("passwordHint"),
    draft: data.draft === true,
    pinned: data.pinned === true,
    comment: data.comment !== false,
    encrypted: data.encrypted === true,
    hideHomeContent: data.hideHomeContent === true,
  };
}

export function patchArticleSource(source: string, fields: ArticleFields): string {
  const { parts, document } = parse(source);
  const setText = (key: keyof ArticleFields) => {
    const value = String(fields[key]).trim();
    if (value || document.has(key)) {
      if (value) document.set(key, value);
      else document.delete(key);
    }
  };
  document.set("title", fields.title.trim());
  document.set("published", fields.published.trim());
  for (const key of [
    "updated",
    "description",
    "image",
    "category",
    "author",
    "lang",
    "alias",
    "permalink",
    "sourceLink",
    "licenseName",
    "licenseUrl",
    "password",
    "passwordHint",
    "slug",
  ] as const)
    setText(key);
  const tags = fields.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (tags.length || document.has("tags")) {
    document.set("tags", tags);
    const tagsNode = document.get("tags", true);
    if (isSeq(tagsNode)) {
      tagsNode.flow = true;
    }
  }
  for (const [key, defaultValue] of [
    ["draft", false],
    ["pinned", false],
    ["comment", true],
    ["encrypted", false],
    ["hideHomeContent", false],
  ] as const) {
    if (document.has(key) || fields[key] !== defaultValue) document.set(key, fields[key]);
  }
  if (fields.priority.trim()) document.set("priority", Number(fields.priority));
  else if (document.has("priority")) document.delete("priority");
  const nextYaml = document
    .toString({ flowCollectionPadding: false, lineWidth: 0 })
    .replace(/\n/g, parts.newline);
  const result = parts.opening + nextYaml + parts.closing + parts.body;
  parseArticleSource(result);
  return result;
}

export function newArticleSource(
  fields: Pick<ArticleFields, "title" | "published" | "draft">,
  body: string,
): string {
  const document = parseDocument("{}");
  document.set("title", fields.title.trim());
  document.set("published", fields.published.trim());
  document.set("draft", fields.draft);
  const source = "---\n" + document.toString({ lineWidth: 0 }) + "---\n\n" + body;
  parseArticleSource(source);
  return source;
}
