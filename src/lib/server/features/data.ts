import type { ProjectReport } from "../project";
import { FeatureError } from "./errors";
import { locations, writable } from "./paths";
import { backupDir } from "./storage";
import { dataDescriptor } from "./registry";
import { hasExpression, validateValue } from "./validation";
import { readManagedFile, StorageConflict, writeManagedFile } from "../storage";
import { resolveManagedPath } from "../path-guard";
import {
  parseConfigInitializer,
  replaceConfigInitializer,
  type ConfigValue,
} from "../config-format";
export async function readFeatureData(report: ProjectReport, key: string) {
  const item = dataDescriptor(key);
  const place = locations(report);
  const relative = `${place.data}/${item.file}`;
  const file = await readManagedFile(place.root, relative);
  const parsed = parseConfigInitializer(file.content, item.variable, item.shape);
  const expression = hasExpression(parsed.value);
  return {
    report,
    descriptor: item,
    value: parsed.value,
    version: file.version,
    sourcePath: resolveManagedPath(place.root, relative),
    readOnly: report.readOnly || expression,
    warnings: expression ? ["数据包含枚举或代码表达式，面板为避免破坏源码已切换为只读。"] : [],
  };
}

export async function saveFeatureData(
  report: ProjectReport,
  key: string,
  value: ConfigValue,
  version: string,
) {
  const place = writable(report);
  const item = dataDescriptor(key);
  if (item.shape === "array" && !Array.isArray(value))
    throw new FeatureError(`${item.label}必须是数组`);
  if (item.shape === "object" && (!value || typeof value !== "object" || Array.isArray(value)))
    throw new FeatureError(`${item.label}必须是对象`);
  validateValue(value, item.key);
  const relative = `${place.data}/${item.file}`;
  const current = await readManagedFile(place.root, relative);
  if (current.version !== version)
    throw new StorageConflict("特色页数据已在其他位置修改，请重新加载");
  const initializer = JSON.stringify(value, null, "\t");
  const source = replaceConfigInitializer(current.content, item.variable, initializer, item.shape);
  const result = await writeManagedFile(place.root, relative, source, version, backupDir(), {
    domain: "feature",
    projectRoot: report.root,
  });
  return { document: await readFeatureData(report, key), backupPath: result.backupPath };
}
