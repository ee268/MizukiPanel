import type { ProjectReport } from "../project";
import { FeatureError } from "./errors";
export function writable(report: ProjectReport) {
  if (report.readOnly || report.mode === "blocked")
    throw new FeatureError("当前工作区只读，无法修改特色页");
  return locations(report);
}
export function locations(report: ProjectReport) {
  return report.mode === "external"
    ? {
        root: report.contentRoot!,
        data: "data",
        spec: "spec",
        animes: "animes",
        albums: "images/albums",
      }
    : {
        root: report.root,
        data: "src/data",
        spec: "src/content/spec",
        animes: "src/content/animes",
        albums: "public/images/albums",
      };
}
