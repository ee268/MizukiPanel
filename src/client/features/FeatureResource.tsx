import type { ProjectReport } from "../types";
import { Albums } from "./Albums";
import { AnimeSeasons } from "./AnimeSeasons";
import type { FeatureEditorCallbacks } from "./common";
import { DataEditor } from "./DataEditor";
import { TextEditor } from "./TextEditor";

interface FeatureResourceProps extends FeatureEditorCallbacks {
  resource?: string;
  report: ProjectReport;
}

export function FeatureResource({ resource, report, notify, fail }: FeatureResourceProps) {
  if (!resource) {
    return null;
  }

  if (resource === "aboutText" || resource === "friendsText") {
    return <TextEditor key={resource} resource={resource} notify={notify} fail={fail} />;
  }

  if (resource === "animeSeasons") {
    return <AnimeSeasons notify={notify} fail={fail} />;
  }

  if (resource === "albums") {
    return <Albums report={report} notify={notify} fail={fail} />;
  }

  return <DataEditor key={resource} resource={resource} notify={notify} fail={fail} />;
}
