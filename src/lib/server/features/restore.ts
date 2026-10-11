import type { ProjectReport } from "../project";
import { locations, writable } from "./paths";
import { backupDir } from "./storage";
import { dataDescriptor, textDescriptor } from "./registry";
import { restoreManagedFile } from "../storage";
import { readFeatureData } from "./data";
import { readFeatureText } from "./text";
export async function restoreFeatureFile(
  report: ProjectReport,
  kind: "data" | "text",
  key: string,
  backupPath: string,
  version: string,
) {
  const place = writable(report);
  let relative: string;
  if (kind === "data") relative = `${place.data}/${dataDescriptor(key).file}`;
  else {
    const item = textDescriptor(key);
    relative = report.mode === "external" ? item.relative : `src/content/${item.relative}`;
  }
  await restoreManagedFile(place.root, relative, backupPath, version, backupDir(), {
    domain: "feature",
    projectRoot: report.root,
  });
  return kind === "data" ? readFeatureData(report, key) : readFeatureText(report, key);
}
