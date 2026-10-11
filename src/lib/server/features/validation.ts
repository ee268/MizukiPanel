import { FeatureError } from "./errors";
import type { ConfigValue } from "../config-format";
export function hasExpression(value: ConfigValue): boolean {
  if (typeof value === "string") return value.startsWith("«expression:");
  if (Array.isArray(value)) return value.some(hasExpression);
  return Boolean(value && typeof value === "object" && Object.values(value).some(hasExpression));
}

export function validateUrl(value: string, field: string) {
  if (!value || value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) return;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new FeatureError(`${field} 必须是 http(s) URL 或站点相对路径`);
  }
}

export function validateValue(value: ConfigValue, pathLabel = ""): void {
  if (Array.isArray(value)) {
    const ids = new Set<string>();
    for (const [index, item] of value.entries()) {
      if (item && typeof item === "object" && !Array.isArray(item) && typeof item.id === "string") {
        if (ids.has(item.id))
          throw new FeatureError(`${pathLabel || "列表"}存在重复 id：${item.id}`);
        ids.add(item.id);
      }
      validateValue(item, `${pathLabel}[${index}]`);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const field = pathLabel ? `${pathLabel}.${key}` : key;
    if (
      typeof child === "string" &&
      [
        "url",
        "siteurl",
        "imgurl",
        "image",
        "cover",
        "src",
        "thumbnail",
        "link",
        "liveDemo",
        "sourceCode",
        "visitUrl",
      ].includes(key)
    )
      validateUrl(child, field);
    if (
      typeof child === "string" &&
      ["date", "startDate", "endDate"].includes(key) &&
      child &&
      Number.isNaN(Date.parse(child))
    )
      throw new FeatureError(`${field} 不是有效日期`);
    validateValue(child, field);
  }
}
