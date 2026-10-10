import {
  Alert,
  Box,
  Chip,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import type { RecentProject } from "../../shared/workspace";

export function RecentProjectList({
  projects,
  selectedId,
  defaultProjectId,
  disabled,
  onSelect,
  actions,
}: {
  projects: RecentProject[];
  selectedId: string | null;
  defaultProjectId?: string;
  disabled: boolean;
  onSelect: (id: string) => void;
  actions?: (project: RecentProject) => ReactNode;
}) {
  if (!projects.length) return <Typography color="text.secondary">暂无最近项目。</Typography>;
  return (
    <RadioGroup
      aria-label="最近项目列表"
      value={selectedId ?? ""}
      onChange={(_, id) => onSelect(id)}
      sx={{ gap: 1.5 }}
    >
      {projects.map((project) => (
        <Box
          key={project.id}
          onClick={(event) => {
            if (disabled || (event.target instanceof Element && event.target.closest("button, a")))
              return;
            onSelect(project.id);
          }}
          sx={{
            p: 1.5,
            minWidth: 0,
            border: 1,
            borderRadius: 1,
            borderColor: selectedId === project.id ? "primary.main" : "divider",
            bgcolor: selectedId === project.id ? "action.selected" : "transparent",
            cursor: disabled ? "default" : "pointer",
          }}
        >
          <FormControlLabel
            value={project.id}
            disabled={disabled}
            control={<Radio size="small" />}
            sx={{
              m: 0,
              width: "100%",
              alignItems: "flex-start",
              "& .MuiRadio-root": { p: 0, mr: 1.5, mt: 0.25 },
              "& .MuiFormControlLabel-label": { flex: 1, minWidth: 0 },
            }}
            label={
              <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                  {project.path}
                </Typography>
                {defaultProjectId === project.id && <Chip size="small" label="默认项目" />}
              </Stack>
            }
          />
          {project.error && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {project.error}
            </Alert>
          )}
          {actions && <Box sx={{ mt: 1 }}>{actions(project)}</Box>}
        </Box>
      ))}
    </RadioGroup>
  );
}
