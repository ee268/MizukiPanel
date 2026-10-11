import type { ProjectReport } from "../project";
import { locations, writable } from "./paths";
import { backupDir, optionalFile } from "./storage";
import { textDescriptor } from "./registry";
import { StorageConflict, writeManagedFile } from "../storage";
export async function readFeatureText(report: ProjectReport, key: string) {
  const item = textDescriptor(key);
  const place = locations(report);
  const relative = report.mode === "external" ? item.relative : `src/content/${item.relative}`;
  const file = await optionalFile(place.root, relative);
  return {
    report,
    key,
    label: item.label,
    content: file?.content ?? "",
    version: file?.version ?? "",
    exists: Boolean(file),
    readOnly: report.readOnly,
  };
}

export async function saveFeatureText(
  report: ProjectReport,
  key: string,
  content: string,
  version: string,
) {
  const item = textDescriptor(key);
  const place = writable(report);
  const relative = report.mode === "external" ? item.relative : `src/content/${item.relative}`;
  const current = await optionalFile(place.root, relative);
  if ((current?.version ?? "") !== version)
    throw new StorageConflict("正文已在其他位置修改，请重新加载");
  const result = await writeManagedFile(
    place.root,
    relative,
    content,
    current?.version ?? null,
    backupDir(),
    { domain: "feature", projectRoot: report.root },
  );
  return { document: await readFeatureText(report, key), backupPath: result.backupPath };
}
