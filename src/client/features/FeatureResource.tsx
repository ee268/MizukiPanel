import type { ProjectReport } from "../types";
import { Albums } from "./Albums";
import { AnimeSeasons } from "./AnimeSeasons";
import type { FeatureEditorCallbacks } from "./common";
import { DataEditor } from "./DataEditor";
import { TextEditor } from "./TextEditor";
import { Box } from "@mui/material";
import { useLiveProjectReport } from "../workspace/WorkspaceSessionProvider";

interface FeatureResourceProps extends FeatureEditorCallbacks {
  resource?: string;
  report: ProjectReport;
}

export function FeatureResource({ resource, report, notify, fail }: FeatureResourceProps) {
  const currentReport = useLiveProjectReport(report)!;
  return (
    <Box
      component="fieldset"
      disabled={currentReport.readOnly}
      sx={{ p: 0, m: 0, border: 0, minWidth: 0 }}
    >
      <Resource resource={resource} report={currentReport} notify={notify} fail={fail} />
    </Box>
  );
}
function Resource({ resource, report, notify, fail }: FeatureResourceProps) {
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
