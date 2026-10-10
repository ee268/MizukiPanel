import { Button, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import type { RecentProject } from "../../shared/workspace";
import { RecentProjectList } from "./RecentProjectList";

export function RecentProjects({
  projects,
  defaultProjectId,
  busy,
  onConnect,
}: {
  projects: RecentProject[];
  defaultProjectId?: string;
  busy: boolean;
  onConnect: (path: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = projects.find((project) => project.id === selectedId);
  useEffect(() => {
    if (selectedId && !projects.some((project) => project.id === selectedId)) setSelectedId(null);
  }, [projects, selectedId]);
  return (
    <Paper component="section" aria-label="最近项目" variant="outlined" sx={{ p: 3, minWidth: 0 }}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2">
          最近项目
        </Typography>
        <RecentProjectList
          projects={projects}
          selectedId={selected?.id ?? null}
          defaultProjectId={defaultProjectId}
          disabled={busy}
          onSelect={setSelectedId}
        />
        <Button
          size="small"
          disabled={busy || !selected?.available}
          onClick={() => selected && onConnect(selected.path)}
          sx={{ alignSelf: "flex-start" }}
        >
          连接项目
        </Button>
      </Stack>
    </Paper>
  );
}
