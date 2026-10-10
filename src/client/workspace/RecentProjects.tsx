import { Alert, Button, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import type { RecentProject } from "../../shared/workspace";

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
  return (
    <Paper component="section" aria-label="最近项目" variant="outlined" sx={{ p: 3, minWidth: 0 }}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2">
          最近项目
        </Typography>
        {!projects.length && <Typography color="text.secondary">暂无最近项目。</Typography>}
        <Stack spacing={2} divider={<Divider />}>
          {projects.map((project) => (
            <Stack key={project.id} spacing={1}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                  {project.path}
                </Typography>
                {defaultProjectId === project.id && <Chip size="small" label="默认项目" />}
              </Stack>
              {project.error && <Alert severity="warning">{project.error}</Alert>}
              <Button
                size="small"
                disabled={busy || !project.available}
                onClick={() => onConnect(project.path)}
                sx={{ alignSelf: "flex-start" }}
              >
                连接项目
              </Button>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
